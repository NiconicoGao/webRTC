package server

import (
	"errors"
	"net"
	"p2p-server/pkg/util"
	"sync"
	"time"

	"github.com/chuckpreslar/emission"
	"github.com/gorilla/websocket"
)

const pingPeriod = 5 * time.Second

type WebSocketConn struct {
	emission.Emitter

	socket *websocket.Conn

	mutex *sync.Mutex

	closed bool
}

func NewWebSocketConn(socket *websocket.Conn) *WebSocketConn {

	var conn WebSocketConn

	conn.Emitter = *emission.NewEmitter()
	conn.socket = socket
	conn.mutex = new(sync.Mutex)
	conn.closed = false
	conn.socket.SetCloseHandler(func(code int, text string) error {
		util.Warnf("%s [%d]", text, code)
		conn.Emit("close", code, text)
		conn.closed = true
		return nil
	})

	return &conn
}

func (conn *WebSocketConn) ReadMessage() {

	in := make(chan []byte)

	stop := make(chan struct{})

	pingTicker := time.NewTicker(pingPeriod)

	var c = conn.socket

	go func() {
		for {
			_, message, err := c.ReadMessage()

			if err != nil {
				util.Warnf("获取错误:%v", err)

				if c, k := err.(*websocket.CloseError); k {
					conn.Emit("close", c.Code, c.Text)
				} else {
					if c, k := err.(*net.OpError); k {
						conn.Emit("close", 1008, c.Error)
					}
				}
				close(stop)
				break
			}
			in <- message
		}
	}()

	for {

		select {
		case _ = <-pingTicker.C:
			util.Infof("发送心跳包....")

			heartPackage := map[string]interface{}{
				"type": "heartPackage",
				"data": "",
			}
			if err := conn.Send(util.Marshal(heartPackage)); err != nil {
				util.Infof("发送心跳包错误....")
				pingTicker.Stop()
				return
			}
		case message := <-in:
			{
				util.Infof("接收到的数据: %s", message)
				conn.Emit("message", []byte(message))
			}
		case <-stop:
			return

		}

	}

}

func (conn *WebSocketConn) Send(message string) error {
	util.Infof("发送数据:%s", message)
	conn.mutex.Lock()
	defer conn.mutex.Unlock()
	if conn.closed {
		return errors.New("websocket: write closed")
	}
	return conn.socket.WriteMessage(websocket.TextMessage, []byte(message))
}

func (conn *WebSocketConn) Close() {
	conn.mutex.Lock()
	defer conn.mutex.Unlock()
	if conn.closed == false {
		util.Infof("关闭WebSocket连接:", conn)
		conn.socket.Close()
		conn.closed = true
	} else {
		util.Infof("连接已关闭:", conn)
	}
}
