package room

import "p2p-server/pkg/server"

type UserInfo struct {
	ID				string `json:"id"`
	Name			string `json:"name"`
}

type User struct {
	info    UserInfo
	conn *server.WebSocketConn
}

type Session struct {
	id			string
	from 		User
	to          User
}