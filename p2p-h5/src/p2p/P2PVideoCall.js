import * as events from 'events';
import Axios from 'axios';
import { message } from 'antd';

var RTCPeerConnection;
var RTCSessionDescription;
var configuration;

export default class P2PVideoCall extends events.EventEmitter {

    constructor(p2pUrl,turnUrl,name,roomId){
        super();
        this.socket = null;
        this.peerConnections = {};
        this.sessionId = '000-111';
        this.userId = 0;
        this.name = name;
        this.roomId = roomId;
        this.p2pUrl = p2pUrl;
        this.turnUrl = turnUrl;
        this.localStream;

        RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection; 
        RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription; 
        navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia; 
        
        configuration = {"iceServers": [{"url":"stun:stun.l.google.com:19302"}]};

        Axios.get(this.turnUrl,{}).then(res => {
            if(res.status === 200){
                let _turnCredential = res.data;
                configuration = {"iceServers":[
                    {
                        "url":_turnCredential["uris"][0],
                        "username":_turnCredential['username'],
                        'credential':_turnCredential['password']
                        
                    }
                ]};
                console.log("configuration:" + JSON.stringify(configuration));
            }
        }).catch((error)=>{
            console.log('网络错误:请求不到TurnServer服务器');
        });

        this.socket = new WebSocket(this.p2pUrl);
        this.socket.onopen = () => {
            console.log("WebSocket连接成功...");
            this.userId = this.getRandomUserId();

            let message = {
                'type':'joinRoom',
                'data':{
                    name:this.name,
                    id:this.userId,
                    roomId:this.roomId,
                }
            };
            this.send(message);
        };

        this.socket.onmessage = (e) => {
            var parseMessage = JSON.parse(e.data);
            console.info('收到的消息:{\n type= ' + parseMessage.type + ', \n data = ' + JSON.stringify(parseMessage.data) + '\n}');
            
            switch(parseMessage.type){
                case 'offer':
                    this.onOffer(parseMessage);
                    break;
                case 'answer':
                    this.onAnswer(parseMessage);
                    break;
                case 'candidate':
                    this.onCandidate(parseMessage);
                    break;
                case 'updateUserList':
                    this.onUpdateUserList(parseMessage);
                    break;
                case 'leaveRoom':
                    this.onLeave(parseMessage);
                    break;
                case 'hangUp':
                    this.onHangUp(parseMessage);
                    break;
                case 'heartPackage':
                    console.log('服务端发心跳包!')
                    break;
                default:
                    console.error('未知消息',parseMessage);
            }
        };

        this.socket.onerror = (e) => {
            console.log('onerror::' + e.data);
        }

        this.socket.onclose = (e) => {
            console.log('onclose::' + e.data);
        }

    }

    getLocalStream = (type) => {
        return new Promise((pRsolve,pReject) => {
            var constraints = {audio:true,video :(type === 'video') ? {width: 1280,height:720} :false};

            if(type == 'screen'){
                navigator.mediaDevices.getDisplayMedia({video:true}).then((mediastream) => {
                    pRsolve(mediastream);
                }).catch((err) => {
                    console.log(err.name + ": " + err.message);
                    pReject(err);
                }
                );
            }else{
                navigator.mediaDevices.getUserMedia(constraints).then((mediastream) => {
                    pRsolve(mediastream);
                }).catch((err) => {
                    console.log(err.name + ": " + err.message);
                    pReject(err);
                }
                );
            }
        })
    }


    getRandomUserId(){
        var num = "";
        for(var i=0; i < 6; i++){
            num += Math.floor(Math.random() * 10);
        }
        return num;
    }

    send = (data) => {
        this.socket.send(JSON.stringify(data));
    }

    startCall = (remoteUserId,media) => {
        this.sessionId = this.userId + "-" + remoteUserId;
        this.getLocalStream(media).then((stream) => {
            this.localStream = stream;
            this.createPeerConnection(remoteUserId,media,true,stream);
            this.emit('localstream',stream);
            this.emit('newCall',this.userId,this.sessionId);

        });
    }


    createPeerConnection = (id,media,isOffer,localstream) => {
        console.log("创建PeerConnection..");
        var pc = new RTCPeerConnection(configuration);
        this.peerConnections[""+id] = pc;
        pc.onicecandidate = (event) => {
            console.log('onicecandidate',event);
            if(event.candidate){
                let message = {
                    type:'candidate',
                    data:{
                        to:id,
                        from:this.userId,
                        candidate:{
                            'sdpMLineIndex':event.candidate.sdpMLineIndex,
                            'sdpMid':event.candidate.sdpMid,
                            'candidate':event.candidate.candidate,
                        },
                        sessionId:this.sessionId,
                        roomId:this.roomId,
                    }
                };
                this.send(message);
            }
        };

        pc.onnegotiationneeded = () => {
            console.log('onnegotiationneeded');
        };

        pc.oniceconnectionstatechange = () => {
            console.log('oniceconnectionstatechange',event);
        };

        pc.onsignalingstatechange = () => {
            console.log('onsignalingstatechange',event);
        };

        pc.onaddstream = (event) => {
            console.log('onaddstream',event);
            this.emit('addstream',event.stream);
        };

        pc.addStream(localstream);

        if(isOffer){
            this.createOffer(pc,id,media);
        }

        return pc;
    
    }



    onUpdateUserList = (message) => {
        var data = message.data;
        console.log("users = " + JSON.stringify(data));
        this.emit('updateUserList',data,this.userId);
    }

    onOffer = (message) => {
        var data = message.data;
        var from = data.from;
        console.log("data:" + data);
        var media = 'video';
        this.sessionId = data.sessionId;
        this.emit('newCall',from,this.sessionId);

        this.getLocalStream(media).then((stream) => {
            this.localStream = stream;
            this.emit('localstream',stream);
            var pc = this.createPeerConnection(from,media,false,stream);

            if(pc && data.description){
                pc.setRemoteDescription(new RTCSessionDescription(data.description),()=>{

                    pc.createAnswer((desc) => {
                        console.log('createAnswer:',desc);
                        pc.setLocalDescription(desc,()=>{
                            console.log('setLocalDescription',pc.localDescripton);
                            let message = {
                                type:'answer',
                                data:{
                                    to:from,
                                    from:this.userId,
                                    description:{'sdp':desc.sdp,'type':desc.type},
                                    sessionId:this.sessionId,
                                    roomId:this.roomId,
                                },
                            };
                            this.send(message);
                        },this.logError);
                    },this.logError);

                },this.logError);
            }
        });
    }

    onAnswer = (message) => {
        console.log("onAnswer:" + message);
        var data = message.data;
        var from = data.from;
        var pc = null;
        if(from in this.peerConnections){
            pc = this.peerConnections[from];
        }
        if(pc && data.description){
            pc.setRemoteDescription(new RTCSessionDescription(data.description),()=> {
            },this.logError);
        }
    }

    onCandidate = (message) => {
        var data = message.data;
        var from = data.from;
        var pc = null;
        if(from in this.peerConnections){
            pc = this.peerConnections[from];
        }
        if(pc && data.candidate){
            pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }

    createOffer = (pc,id,media) => {
        pc.createOffer((desc) => {
            console.log('createOffer:',desc.sdp);
            pc.setLocalDescription(desc,()=>{
                console.log('setLocalDescription',pc.localDescripton);
                let message = {
                    type:'offer',
                    data:{
                        to:id,
                        from:this.userId,
                        description:{'sdp':desc.sdp,'type':desc.type},
                        sessionId:this.sessionId,
                        media:media,
                        roomId:this.roomId,
                    },
                };
                this.send(message);
            },this.logError);
        },this.logError);
    }

    logError = (error) => {
        console.log("logError",error);
    }

    hangUp = () => {
        let message = {
            type:'hangUp',
            data:{
                sessionId:this.sessionId,
                from:this.userId,
                roomId:this.roomId,
            }
        }
        this.send(message);
    }

    onHangUp = (message) => {
        var data = message.data;
        var ids = data.sessionId.split("-");
        var to = data.to;
        console.log('挂断:sessionId:',data.sessionId);
        var peerConnections = this.peerConnections;
        var pc1 = peerConnections[ids[0]];
        var pc2 = peerConnections[ids[1]];
        if(pc1 !== undefined){
            console.log("关闭视频");
            pc1.close();
            delete peerConnections[ids[0]];
        }
        if(pc2 !== undefined){
            console.log("关闭视频");
            pc2.close();
            delete peerConnections[ids[1]];
        }
        if (this.localStream != null){
            this.closeMediaStream(this.localStream);
            this.localStream = null;
        }
        this.emit('hangUp',to,this.sessionId);
        this.sessionId = '000-111';
    }

    onLeave = (message) => {
        var id = message.data;
        console.log('leave',id);
        var peerConnections = this.peerConnections;
        var pc = peerConnections[id];
        if(pc !== undefined){
            pc.close();
            delete peerConnections[id];
            this.emit('leave',id);
        }
        if (this.localStream != null){
            this.closeMediaStream(this.localStream);
            this.localStream = null;
        }
    }

    closeMediaStream = (stream) => {
        if(!stream){
            return;
        }
        let tracks = stream.getTracks();
        for(let i=0,len = tracks.length; i< len;i++){
            tracks[i].stop();
        }
    }

}