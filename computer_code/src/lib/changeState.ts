import { socket } from "./socket";
import { States } from "./states";

export default function changeState(newState: States) {
    socket.emit("change-mocap-state", newState)
}