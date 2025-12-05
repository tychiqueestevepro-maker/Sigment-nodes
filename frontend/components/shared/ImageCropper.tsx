'use client';

import React, { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react';

interface ImageCropperProps {
    imageSrc: string;
    onCropComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
    aspectRatio?: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
    imageSrc,
    onCropComplete,
    onCancel,
    aspectRatio = 1
}) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const onCropChange = useCallback((newCrop: Point) => {
        setCrop(newCrop);
    }, []);

    const onZoomChange = useCallback((newZoom: number) => {
        setZoom(newZoom);
    }, []);

    const onCropCompleteCallback = useCallback(
        (_croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        []
    );

    const handleConfirm = async () => {
        if (!croppedAreaPixels) return;

        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
            onCropComplete(croppedBlob);
        } catch (error) {
            console.error('Error cropping image:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                    <X size={20} />
                    <span>Cancel</span>
                </button>
                <h2 className="text-white font-semibold">Crop Image</h2>
                <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition-colors"
                >
                    <Check size={18} />
                    <span>Apply</span>
                </button>
            </div>

            {/* Cropper Area */}
            <div className="relative flex-1">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={aspectRatio}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={onCropChange}
                    onZoomChange={onZoomChange}
                    onCropComplete={onCropCompleteCallback}
                />
            </div>

            {/* Controls */}
            <div className="bg-black/50 p-6">
                <div className="max-w-md mx-auto space-y-4">
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-4">
                        <ZoomOut size={20} className="text-white/60" />
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer
                                       [&::-webkit-slider-thumb]:appearance-none
                                       [&::-webkit-slider-thumb]:w-5
                                       [&::-webkit-slider-thumb]:h-5
                                       [&::-webkit-slider-thumb]:bg-white
                                       [&::-webkit-slider-thumb]:rounded-full
                                       [&::-webkit-slider-thumb]:cursor-pointer
                                       [&::-webkit-slider-thumb]:shadow-lg"
                        />
                        <ZoomIn size={20} className="text-white/60" />
                    </div>

                    {/* Rotation Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={() => setRotation((prev) => (prev + 90) % 360)}
                            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                        >
                            <RotateCw size={18} />
                            <span>Rotate</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper function to create a cropped image
async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    rotation: number = 0
): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    // Set canvas size to safe area for rotation
    canvas.width = safeArea;
    canvas.height = safeArea;

    // Translate canvas context to center
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    // Draw rotated image
    ctx.drawImage(
        image,
        safeArea / 2 - image.width / 2,
        safeArea / 2 - image.height / 2
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    // Set canvas size to final crop size
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Paste rotated image with correct offset
    ctx.putImageData(
        data,
        Math.round(0 - safeArea / 2 + image.width / 2 - pixelCrop.x),
        Math.round(0 - safeArea / 2 + image.height / 2 - pixelCrop.y)
    );

    // Convert to blob
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob'));
                }
            },
            'image/jpeg',
            0.95
        );
    });
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', reject);
        image.crossOrigin = 'anonymous';
        image.src = url;
    });
}

export default ImageCropper;
