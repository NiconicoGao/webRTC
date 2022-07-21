import React, {Component} from 'react';
import PropTypes from "prop-types";

export default class RemoteVideoView extends Component{

    componentDidMount = () => {
        let video = this.refs[this.props.id];
        video.srcObject = this.props.stream;
        video.onloadedmetadata = (e) => {
            video.play();
        }
    }

    render(){

        const style = {
            position:'absolute',
            left:'0px',
            right:'0px',
            top:'0px',
            bottom:'0px',
            backgroundColor:'#323232',
            zIndex:0,
        }

        const videoMuteIcon = {
            position:'absolute',
            color:'#fff',
        }

        return (
            <div key={this.props.id} style={style}>
                <video ref={this.props.id} id={this.props.id} autoPlay playsInline
                style={{width:'100%',height:'100%',objectFit:'contain'}}
                />
            </div>
        )

    }

}

RemoteVideoView.prototypes = {
    stream: PropTypes.any.isRequired,
    id:PropTypes.string,
}