"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Camera, CameraSlash, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

type CameraDevice = { deviceId: string; label: string };

export function CameraScanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [lastCode, setLastCode] = useState("");

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  async function loadDevices() {
    setError("");
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoDevices = await BrowserCodeReader.listVideoInputDevices();
      permissionStream.getTracks().forEach((track) => track.stop());
      const mapped = videoDevices.map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` }));
      setDevices(mapped);
      const rear = mapped.find((device) => /back|rear|environment/i.test(device.label));
      setSelectedDevice((current) => current || rear?.deviceId || mapped[0]?.deviceId || "");
    } catch {
      setError("Camera access was not granted. Allow camera permission or use manual barcode entry.");
    }
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera scanning is not supported in this browser. Use manual barcode entry.");
      return;
    }
    setError("");
    if (!devices.length) await loadDevices();
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(selectedDevice || undefined, videoRef.current!, (result) => {
        if (!result) return;
        const code = result.getText();
        if (code === lastCode) return;
        setLastCode(code);
        onDetected(code);
      });
      controlsRef.current = controls;
      setRunning(true);
    } catch {
      setError("The selected camera could not start. Try another camera or enter the barcode manually.");
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#13201b]">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!running && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              <Camera size={34} weight="duotone" className="mx-auto mb-3 text-emerald-300" />
              <p className="font-semibold">Camera preview</p>
              <p className="mt-1 max-w-xs text-sm text-white/65">Use any built-in, USB, or mobile camera recognized by your browser.</p>
            </div>
          </div>
        )}
        {running && <div className="scan-line pointer-events-none absolute inset-x-[12%] top-1/2 h-px bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />}
      </div>

      {error && <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800"><WarningCircle className="mt-0.5 shrink-0" size={18} weight="fill" />{error}</div>}
      {lastCode && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle size={18} weight="fill" />Detected: <strong>{lastCode}</strong></div>}

      <div>
        <label className="field-label" htmlFor="camera-device">Camera</label>
        <select id="camera-device" className="select-field" value={selectedDevice} onChange={(event) => { stop(); setSelectedDevice(event.target.value); }}>
          <option value="">Default camera</option>
          {devices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {!running ? <Button onClick={start}><Camera size={18} />Start camera</Button> : <Button variant="secondary" onClick={stop}><CameraSlash size={18} />Stop camera</Button>}
        <Button variant="ghost" onClick={loadDevices}>Refresh camera list</Button>
      </div>
    </div>
  );
}
