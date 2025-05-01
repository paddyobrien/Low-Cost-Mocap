import { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import Modal from './Modal';
import { Modes } from '../lib/modes';

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

export default function ConnectionManager({updateState}:{updateState: (s: Modes) => void}) {
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
            updateState(json);
        });
        return () => {
            socket.off("connect")
        }
    }, [])

    if (isConnected) {
        return <></>
    }

    return (
        <Modal headerText="Connection Error" bodyText="Cannot connect to backend, please (re)start the python server." />
    );
}