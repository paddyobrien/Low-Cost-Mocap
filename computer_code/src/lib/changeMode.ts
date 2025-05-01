import { socket } from "./socket";
import { States } from "./modes";

export default function changeMode(newState: States) {
    socket.emit("change-mocap-mode", newState)
}