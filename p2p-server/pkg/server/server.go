package server

import (
	"net/http"
	"p2p-server/pkg/util"
	"strconv"

	"github.com/gorilla/websocket"
)

type P2PServerConfig struct {
	Host          string
	Port          int
	CertFile      string
	KeyFile       string
	HTMLRoot      string
	WebSocketPath string
}

func DefaultConfig() P2PServerConfig {
	return P2PServerConfig{
		Host:          "0.0.0.0",
		Port:          8000,
		HTMLRoot:      "html",
		WebSocketPath: "/ws",
	}
}

type P2PServer struct {
	handleWebSocket func(ws *WebSocketConn, request *http.Request)

	upgrader websocket.Upgrader
}

func NewP2PServer(wsHandler func(ws *WebSocketConn, request *http.Request)) *P2PServer {

	var server = &P2PServer{
		handleWebSocket: wsHandler,
	}

	server.upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	return server

}

func (server *P2PServer) handleWebSocketRequest(writer http.ResponseWriter, request *http.Request) {
	responseHeader := http.Header{}
	socket, err := server.upgrader.Upgrade(writer, request, responseHeader)
	if err != nil {
		util.Panicf("%v", err)
	}
	wsTransport := NewWebSocketConn(socket)
	server.handleWebSocket(wsTransport, request)
	wsTransport.ReadMessage()

}

func (server *P2PServer) Bind(cfg P2PServerConfig) {
	http.HandleFunc(cfg.WebSocketPath, server.handleWebSocketRequest)
	http.Handle("/", http.FileServer(http.Dir(cfg.HTMLRoot)))
	util.Infof("P2P Server listening on:%s:%d", cfg.Host, cfg.Port)
	panic(http.ListenAndServeTLS(cfg.Host+":"+strconv.Itoa(cfg.Port), cfg.CertFile, cfg.KeyFile, nil))
}
