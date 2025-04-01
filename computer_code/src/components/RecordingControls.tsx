import { useCallback, useEffect, useState } from "react"
import { socket } from "../shared/styles/scripts/socket";
import { Button } from "react-bootstrap";

function createCSV(filename: string, data: [][], times: []) {
    debugger;
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    const lines = data.map((row, idx) => {
        return `${times[idx]},${row.join(",")}`
    })
    
    const blob = new Blob([lines.join("\n")], { type: 'text/plain' });
    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.txt`;
    link.click();
}

export default function RecordingControls({ objectPoints, objectPointTimes }) {

    return <><Button
        size="sm"
        className="me-3"
        variant="outline-primary"
        disabled={objectPoints.current.length < 1}
        onClick={() => {
            createCSV("results", objectPoints.current, objectPointTimes.current);
        }}
    >
        Download {objectPoints.current.length} points
    </Button>
    </>
}