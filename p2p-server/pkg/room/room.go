package room

import (
	"net/http"
	"p2p-server/pkg/server"
	"p2p-server/pkg/util"
	"strings"
)

const (
	JoinRoom       = "joinRoom"
	Offer          = "offer"
	Answer         = "answer"
	Candidate      = "candidate"
	HangUp         = "hangUp"
	LeaveRoom      = "leaveRoom"
	UpdateUserList = "updateUserList"
)

type RoomManager struct {
	rooms map[string]*Room
}

func NewRoomManager() *RoomManager {
	var roomManager = &RoomManager{
		rooms: make(map[string]*Room),
	}
	return roomManager
}

type Room struct {
	users map[string]User

	sessions map[string]Session

	ID string
}

func NewRoom(id string) *Room {
	var room = &Room{
		users:    make(map[string]User),
		sessions: make(map[string]Session),
		ID:       id,
	}
	return room
}

func (roomManager *RoomManager) getRoom(id string) *Room {
	return roomManager.rooms[id]
}

func (roomManager *RoomManager) createRoom(id string) *Room {
	roomManager.rooms[id] = NewRoom(id)
	return roomManager.rooms[id]
}

func (roomManager *RoomManager) deleteRoom(id string) {
	delete(roomManager.rooms, id)
}

func (roomManager *RoomManager) HandleNewWebSocket(conn *server.WebSocketConn, request *http.Request) {
	util.Infof("On Open %v", request)
	conn.On("message", func(message []byte) {
		request, err := util.Unmarshal(string(message))

		if err != nil {
			util.Errorf("解析Json数据Unmarshal错误 %v", err)
			return
		}

		var data map[string]interface{} = nil

		tmp, found := request["data"]
		if !found {
			util.Errorf("没有发现数据")
			return
		}

		data = tmp.(map[string]interface{})

		roomId := data["roomId"].(string)
		util.Infof("房间Id:%v", roomId)

		room := roomManager.getRoom(roomId)

		if room == nil {
			room = roomManager.createRoom(roomId)
		}

		switch request["type"] {
		case JoinRoom:
			onJoinRoom(conn, data, room, roomManager)
			break
		case Offer:
			fallthrough
		case Answer:
			fallthrough
		case Candidate:
			onCandidate(conn, data, room, roomManager, request)
			break
		case HangUp:
			onHangUp(conn, data, room, roomManager, request)
			break
		default:
			{
				util.Warnf("未知的请求 %v", request)
			}
			break
		}

	})

	conn.On("close", func(code int, text string) {
		onClose(conn, roomManager)
	})
}

func onJoinRoom(conn *server.WebSocketConn, data map[string]interface{}, room *Room, roomManager *RoomManager) {
	user := User{
		conn: conn,
		info: UserInfo{
			ID:   data["id"].(string),
			Name: data["name"].(string),
		},
	}
	room.users[user.info.ID] = user
	roomManager.notifyUsersUpdate(conn, room.users)
}

func onCandidate(conn *server.WebSocketConn, data map[string]interface{}, room *Room, roomManager *RoomManager, request map[string]interface{}) {
	to := data["to"].(string)
	if user, ok := room.users[to]; !ok {
		util.Errorf("没有发现用户[" + to + "]")
		return
	} else {
		user.conn.Send(util.Marshal(request))
	}
}

func onHangUp(conn *server.WebSocketConn, data map[string]interface{}, room *Room, roomManager *RoomManager, request map[string]interface{}) {
	sessionID := data["sessionId"].(string)
	ids := strings.Split(sessionID, "-")

	if user, ok := room.users[ids[0]]; !ok {
		util.Errorf("用户 [" + ids[0] + "] 没有找到")
		return
	} else {
		hangUp := map[string]interface{}{
			"type": HangUp,
			"data": map[string]interface{}{
				"to":        ids[0],
				"sessionId": sessionID,
			},
		}
		user.conn.Send(util.Marshal(hangUp))
	}

	if user, ok := room.users[ids[1]]; !ok {
		util.Errorf("用户 [" + ids[1] + "] 没有找到")
		return
	} else {
		hangUp := map[string]interface{}{
			"type": HangUp,
			"data": map[string]interface{}{
				"to":        ids[1],
				"sessionId": sessionID,
			},
		}
		user.conn.Send(util.Marshal(hangUp))
	}
}

func onClose(conn *server.WebSocketConn, roomManager *RoomManager) {
	util.Infof("连接关闭 %v", conn)
	var userId string = ""
	var roomId string = ""

	for _, room := range roomManager.rooms {
		for _, user := range room.users {
			if user.conn == conn {
				userId = user.info.ID
				roomId = room.ID
			}
		}
	}

	if roomId == "" {
		util.Errorf("没有查找到退出的房间及用户")
		return
	}

	util.Infof("退出的用户roomId %v userId %v", roomId, userId)

	for _, user := range roomManager.getRoom(roomId).users {
		if user.conn != conn {
			leave := map[string]interface{}{
				"type": LeaveRoom,
				"data": userId,
			}
			user.conn.Send(util.Marshal(leave))
		}
	}
	util.Infof("删除User", userId)
	delete(roomManager.getRoom(roomId).users, userId)

	roomManager.notifyUsersUpdate(conn, roomManager.getRoom(roomId).users)
}

func (roomManager *RoomManager) notifyUsersUpdate(conn *server.WebSocketConn, users map[string]User) {
	infos := []UserInfo{}
	for _, userClient := range users {
		infos = append(infos, userClient.info)
	}
	request := make(map[string]interface{})
	request["type"] = UpdateUserList
	request["data"] = infos
	for _, user := range users {
		user.conn.Send(util.Marshal(request))
	}
}
