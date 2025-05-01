import { Button, Col, Container, Form, Row } from "react-bootstrap";
import DownloadControls from "./DownloadControls";
import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { Modes } from "../lib/modes";
import { socket } from "../lib/socket";
import SmallHeader from "./SmallHeader";
import InfoTooltip from "./InfoTooltip";
import JSZip from "JSZip"

interface Props {
    mocapMode: Modes,
    objectPoints: MutableRefObject<number[][][]>
    objectPointErrors: any,
    lastObjectPointTimestamp: any,
}

function saveAs(blob, name) {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.zip`;
    link.click();
}

export default function Capture({mocapMode, objectPoints, objectPointErrors, lastObjectPointTimestamp}: Props) {
    const [currentCaptureName, setCurrentCaptureName] = useState("");
    const objectPointTimes = useRef<Array<Array<Array<number>>>>([]);
    const imagePoints = useRef<Array<Array<number>>>([])
    const [isRecording, setIsRecording] = useState(false);

    useEffect(() => {
        const record = (data) => {
            if (isRecording) {
                objectPoints.current.push(data["object_points"]);
                objectPointTimes.current.push(data["time_ms"]);
                objectPointErrors.current.push(data["errors"]);
                imagePoints.current.push(data["image_points"]);
            }
        }
        socket.on("object-points", record)
        return () => {
            socket.off("object-points", record)
        }
    }, [objectPoints, isRecording])

    const canRecord = mocapMode === Modes.Triangulation && currentCaptureName !== "";

    const stopRecording = useCallback(() => {
        const zip = new JSZip();
        zip.file(`${currentCaptureName}/hello.txt`, "Hello[p my)6cxsw2q");
        zip.generateAsync({type:"blob"}).then(function (blob) { // 1) generate the zip file
            saveAs(blob, currentCaptureName);                          // 2) trigger the download
        })
        setIsRecording(false)
    }, [currentCaptureName, isRecording])

    return (
        <Container fluid={true} className="pb-2 shadow-lg container-card">
            <Row>
                <Col>
                    <SmallHeader>Recording Name</SmallHeader>
                    <Form.Control
                        value={currentCaptureName}
                        onChange={(event) => setCurrentCaptureName(event.target.value)}
                    />
                </Col>
            </Row>
            <Row className="mt-2">
                <Col>
            <InfoTooltip disabled={canRecord || isRecording} message="Enable triangulation and add a recording name">
                <Button
                    size='sm'
                    className="mr-2"
                    variant="outline-primary"
                    disabled={!canRecord || isRecording}
                    onClick={() => {
                        objectPoints.current = []
                        objectPointTimes.current = [];
                        imagePoints.current = [];
                        objectPointErrors.current = [];
                        setIsRecording(true);
                    }}>
                    {isRecording ? "Recording..." : "Start recording"}
                </Button>
            </InfoTooltip>
            {isRecording && 
                <>
                    <Button
                        size='sm'
                        className="mr-2"
                        variant="outline-danger"
                        disabled={!canRecord}
                        onClick={stopRecording}>
                        Stop
                    </Button>
                    {objectPoints.current.length} samples captured
                </>
            }
            </Col>
            </Row>
        </Container>
    )
}