package main

import (
	"os"
	"p2p-server/pkg/room"
	"p2p-server/pkg/server"
	"p2p-server/pkg/util"

	"gopkg.in/ini.v1"
)

func main() {
	cfg, err := ini.Load("configs/config.ini")
	if err != nil {
		util.Errorf("读取文件失败:%v", err)
		os.Exit(1)
	}

	roomManager := room.NewRoomManager()
	wsServer := server.NewP2PServer(roomManager.HandleNewWebSocket)

	sslCert := cfg.Section("general").Key("cert").String()
	sslKey := cfg.Section("general").Key("key").String()
	bindAddress := cfg.Section("general").Key("bind").String()

	port, err := cfg.Section("general").Key("port").Int()
	if err != nil {
		port = 8000
	}

	htmlRoot := cfg.Section("general").Key("html_root").String()

	config := server.DefaultConfig()
	config.Host = bindAddress
	config.Port = port
	config.CertFile = sslCert
	config.KeyFile = sslKey
	config.HTMLRoot = htmlRoot
	wsServer.Bind(config)
}
