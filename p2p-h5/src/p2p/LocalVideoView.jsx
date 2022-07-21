import React, {Component} from 'react';
import PropTypes from "prop-types";
import VideocamOffIcon from "mdi-react/VideocamOffIcon";

export default class LocalVideoView extends Component{

    componentDidMount = () => {
        let video = this.refs[this.props.id];
        video.srcObject = this.props.stream;
        video.onloadedmetadata = (e) => {
            video.play();
        }
    }

    render(){

        const small = {
            display:'flex',
            justifyContent: 'center',
            alignItems: 'center',
            //绝对定位
            position: 'absolute',
            //指定宽
            width: '192px',
            //指定高
            height: '108px',
            //底部
            bottom: '60px',
            //右侧
            right: '10px',
            //边框宽度
            borderWidth: '2px',
            //边框样式
            borderStyle: 'solid',
            //边框颜色
            borderColor: '#ffffff',
            //溢出隐藏
            overflow: 'hidden',
            //设置此属性可以使得视频在最上层
            zIndex: 99,
            //边框弧度
            borderRadius: '4px',
        };

        const videoMuteIcon = {
            position:'absolute',
            color:'#fff',
        }

        return (
            <div key={this.props.id} style={small}>
                <video ref={this.props.id} id={this.props.id} autoPlay playsInline muted={true}
                style={{width:'100%',height:'100%',objectFit:'cover'}}
                />
                {
                    this.props.muted? <VideocamOffIcon style={videoMuteIcon}/> : null
                }
            </div>
        )

    }

}

LocalVideoView.prototypes = {
    stream: PropTypes.any.isRequired,
    id:PropTypes.string,
}