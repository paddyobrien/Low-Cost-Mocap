import { useState, useEffect } from 'react';
import { socket } from '../shared/styles/scripts/socket';
import Toast from 'react-bootstrap/Toast';

async function getState() {
    const url = "http://localhost:3001/api/camera_state";
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }
  
      const json = await response.json();
      return json;
    } catch (error) {
      console.error(error.message);
    }
  }

export interface State {
    is_processing_images:boolean,
    is_capturing_points: boolean,
    is_triangulating_points: boolean,
    is_locating_objects: boolean,
}

export default function ConnectionManager({updateState}:{updateState: (json: State) => void}) {
    const [isConnected, setIsConnected] = useState(socket.connected);
    useEffect(() => {
        socket.on("disconnect", () => {
            setIsConnected(false)
        });
        return () => {
            socket.off("disconnect")
        }
    }, [])

    useEffect(() => {
        socket.on("connect", async () => {
            setIsConnected(true);
            const json = await getState();
            console.log(json)
            updateState(json as State);
        });
        return () => {
            socket.off("connect")
        }
    }, [])

    if (isConnected) {
        return <></>
    }

    return (
        <>
            <div style={{
                zIndex: 1,
                position: "fixed",
                left: 0,
                width: "100%",
                top: 0,
                height: "100%",
                backgroundColor: "black",
                opacity: 0.5
            }} />
            <Toast bg="danger" show={true} style={{
                position: "fixed",
                zIndex: 3,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)"
            }}>
                <Toast.Header closeButton={false}>
                    <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                    <strong className="me-auto">Connection Error</strong>
                </Toast.Header>
                <Toast.Body>Cannot connect to backend, please (re)start the python server.</Toast.Body>
            </Toast>
        </>
    );
}