import React from 'react'
import '../../styles/css/p2p.scss';
import P2PLogin from './P2PLogin';
import { Button,List } from 'antd';
import P2PVideoCall from './P2PVideoCall';
import LocalVideoView from './LocalVideoView';
import RemoteVideoView from './RemoteVideoView';
import HangupIcon from "mdi-react/PhoneHangupIcon";
import VideoIcon from "mdi-react/VideoIcon";
import VideocamOffIcon from "mdi-react/VideocamOffIcon";
import MicrophoneIcon from "mdi-react/MicrophoneIcon";
import MicrophoneOffIcon from "mdi-react/MicrophoneOffIcon";

class P2PClient extends React.Component{

    constructor(props){
        super(props);
        this.p2pVideoCall = null;
        this.state = {
            users:[],
            userId:null,
            userName:'',
            roomId:'111111',
            isVideoCall:false,
            isLogin:false,
            localStream:null,
            remoteStream:null,
            audioMuted:false,
            videoMuted:false,
        };
    }

    connectServer = () => {
        var p2pUrl = "wss://www.kangshaojun.com/p2p_ws";
        var turnUrl = "https://www.kangshaojun.com/p2p_turn?service=turn&username=sample";
        console.log("信令服务器地址:" + p2pUrl);
        console.log("中转服务器地址:" + turnUrl);
        this.p2pVideoCall = new P2PVideoCall(p2pUrl,turnUrl,this.state.userName,this.state.roomId);
        this.p2pVideoCall.on('updateUserList',(users,self) => {
            this.setState({
                users:users,
                userId:self,
            });
        });

        this.p2pVideoCall.on('hangUp',(to,session) => {
            this.setState({
                isVideoCall:false,
                localStream:null,
                remoteStream:null,
            });
        });

        this.p2pVideoCall.on('leave',(to,session) => {
            this.setState({
                isVideoCall:false,
                localStream:null,
                remoteStream:null,
            });
        });


        this.p2pVideoCall.on('newCall',(from,sessions) => {
            this.setState({
                isVideoCall:true,
            });
        });

        this.p2pVideoCall.on('localstream',(stream) => {
            this.setState({
                localStream:stream,
            });
        });

        this.p2pVideoCall.on('addstream',(stream) => {
            this.setState({
                remoteStream:stream,
            });
        });


    }

    handleStartCall = (remoteUserId,type) => {
        this.p2pVideoCall.startCall(remoteUserId,type);
    }

    hangUp = () => {
        this.p2pVideoCall.hangUp();
    }

    onVideoCLickHandler = () => {
        let videoMuted = !this.state.videoMuted;
        this.onToggleLocalVideoTrack(videoMuted);
        this.setState({videoMuted});

    }

    onToggleLocalVideoTrack = (muted) => {
        var videoTracks = this.state.localStream.getVideoTracks();
        if(videoTracks.length === 0){
            console.log("没有本地视频");
            return;
        }
        console.log("打开/关闭本地视频.");
        for(var i = 0; i<videoTracks.length; ++i){
            videoTracks[i].enabled = !muted;
        }
    }

    onAudioClickHandler = () => {
        let audioMuted = !this.state.audioMuted;
        this.onToggleLocalAudioTrack(audioMuted);
        this.setState({audioMuted:audioMuted});
    }

    onToggleLocalAudioTrack = (muted) => {
        var audioTracks = this.state.localStream.getAudioTracks();
        if(audioTracks.length === 0){
            console.log("没有本地音频");
            return;
        }
        console.log("打开/关闭本地音频.");
        for(var i = 0; i<audioTracks.length; ++i){
            audioTracks[i].enabled = !muted;
        }
    }


    loginHandler = (userName,roomId) => {
        this.setState({
            isLogin:true,
            userName:userName,
            roomId:roomId,
        });
        this.connectServer();
    }

    render(){
        return(
            <div className="main-layout">
            {!this.state.isLogin ?
                <div className="login-container">
                <h2>一对一视频通话案例</h2>
                <P2PLogin loginHandler={this.loginHandler}/>
                </div>
                :
                !this.state.isVideoCall ?
                <List bordered header={"一对一视频通话案例"} footer={"终端列表(Web/Android/iOS)"}>
                    {
                        this.state.users.map((user,i) =>{
                            return (
                                <List.Item key={user.id}>
                                    <div className="list-item">
                                        {user.name + user.id}
                                        {user.id != this.state.userId &&
                                            <div>
                                                <Button type="link" onClick={()=> this.handleStartCall(user.id,'video')}>视频</Button>
                                                <Button type="link" onClick={()=> this.handleStartCall(user.id,'screen')}>共享桌面</Button>
                                            </div>
                                        }
                                    </div>
                                </List.Item>
                            )
                        }) 
                    }
                </List>
                :
                <div>
                    <div>
                        {
                            this.state.remoteStream != null ? <RemoteVideoView stream={this.state.remoteStream} id={'remoteview'}/> : null
                        }
                        {
                            this.state.localStream != null ? <LocalVideoView stream={this.state.localStream} muted={this.state.videoMuted} id={'localview'}/> : null
                        }
                    </div>  
                    <div className="btn-tools">
                        <Button className="button" ghost size="large" shape="circle" 
                            icon={this.state.videoMuted ? <VideocamOffIcon/> : <VideoIcon/>} 
                            onClick={this.onVideoCLickHandler}>
                        </Button>
                        <Button className="button" ghost size="large" shape="circle" 
                            icon={<HangupIcon />} onClick={this.hangUp}>
                        </Button>
                        <Button className="button" ghost size="large" shape="circle" 
                            icon={this.state.audioMuted ? <MicrophoneOffIcon/> : <MicrophoneIcon/>}
                            onClick={this.onAudioClickHandler}>
                        </Button>
                    </div>     
                </div>

            }
            </div>
        );
    }

}

export default P2PClient;