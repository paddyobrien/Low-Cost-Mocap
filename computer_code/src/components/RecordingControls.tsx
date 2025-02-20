import { useCallback, useEffect, useState } from "react"
import { socket } from "../shared/styles/scripts/socket";
import { Button } from "react-bootstrap";

function createCSV(filename: string, data: unknown) {
    const link = document.createElement( 'a' );
    link.style.display = 'none';
    document.body.appendChild( link );

    const blob = new Blob( [ data ], { type: 'text/plain' } );	
    const objectURL = URL.createObjectURL( blob );
    
    link.href = objectURL;
    link.href = URL.createObjectURL( blob );
    link.download =  `${filename}.txt`;
    link.click();
}

export default function RecordingControls(){
    const [isRecording, setIsRecording] = useState(false);
    const [currentRecording, setCurrentRecording] = useState<any[]>([]);

    const toggleRecording = useCallback((startOrStop: boolean)=> {
        if (!startOrStop) {
            createCSV("testresults", currentRecording)
        }
        setIsRecording(startOrStop);
        setCurrentRecording([]);
        socket.emit("recording-control", { startOrStop });
    }, [currentRecording]);

    useEffect(() => {
        const handler = (data: any) => {
            console.log(data);
            setCurrentRecording([...currentRecording, data]);
        }
        socket.on("recording-data", handler)

        return () => {
          socket.off("recording-data", handler)
        }
    }, [currentRecording]);

    return <Button
                size="sm"
                className="me-3"
                variant="outline-primary"
                active={isRecording}
                onClick={() => {
                    toggleRecording(!isRecording);
                }}
            >
            {isRecording ? "Stop" : "Start"}
        </Button>
}