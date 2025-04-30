import { useCallback, useEffect, useState } from "react"
import { socket } from "../lib/socket";
import { Button } from "react-bootstrap";

function createCSV(filename: string, data: [][], times: []) {
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
    link.download = `${filename}.csv`;
    link.click();
}

function createJSONL(filename: string, data: [][], times: []) {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    const lines = [
        JSON.stringify(times),
        JSON.stringify(data)
    ]
    
    const blob = new Blob([lines.join("\n")], { type: 'text/plain' });
    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.jsonl`;
    link.click();
}

export default function DownloadControls({label, objectPoints, objectPointTimes, type }) {

    return <><Button
        size="sm"
        className="mr-2"
        variant="outline-primary"
        disabled={objectPoints.current.length < 1}
        onClick={() => {
            if (type === 'csv')
                createCSV(label.replace(" ", "_"), objectPoints.current, objectPointTimes.current);
            else
                createJSONL(label.replace(" ", "_"), objectPoints.current, objectPointTimes.current);
        }}
    >
        Download {objectPoints.current.length} {label}
    </Button>
    </>
}