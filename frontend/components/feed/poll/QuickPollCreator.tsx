'use client';

import React, { useState } from 'react';
import { X, Plus, BarChart3, Palette } from 'lucide-react';

// Poll theme colors
const POLL_COLORS = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Green', value: '#22C55E' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Gray', value: '#374151' },
];

interface QuickPollCreatorProps {
    onPollChange: (poll: { question: string; options: string[]; color: string } | null) => void;
    onClose: () => void;
}

// Preset quick poll options
const QUICK_PRESETS = [
    { label: 'Yes/No', options: ['Yes', 'No'] },
    { label: 'Agree/Disagree', options: ['Agree', 'Disagree'] },
    { label: 'Custom', options: ['', ''] },
];

export const QuickPollCreator: React.FC<QuickPollCreatorProps> = ({ onPollChange, onClose }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState(POLL_COLORS[0].value);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const handlePresetClick = (preset: typeof QUICK_PRESETS[0]) => {
        setOptions(preset.options);
        setActivePreset(preset.label);
        updatePoll(question, preset.options, selectedColor);
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
        setActivePreset('Custom');
        updatePoll(question, newOptions, selectedColor);
    };

    const updatePoll = (q: string, opts: string[], color: string) => {
        const validOptions = opts.filter(o => o.trim().length > 0);
        if (q.trim() && validOptions.length >= 2) {
            onPollChange({ question: q.trim(), options: validOptions, color });
        } else {
            onPollChange(null);
        }
    };

    const handleColorChange = (color: string) => {
        setSelectedColor(color);
        setShowColorPicker(false);
        updatePoll(question, options, color);
    };

    const addOption = () => {
        if (options.length < 4) {
            const newOptions = [...options, ''];
            setOptions(newOptions);
            setActivePreset('Custom');
        }
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
            updatePoll(question, newOptions, selectedColor);
        }
    };

    return (
        <div
            className="rounded-lg p-3 mb-2 border-2 transition-colors"
            style={{
                borderColor: selectedColor,
                backgroundColor: `${selectedColor}10`
            }}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5" style={{ color: selectedColor }}>
                    <BarChart3 size={14} />
                    <span className="text-xs font-medium">Quick Poll</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Color picker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className="p-1 rounded hover:bg-white/50 transition-colors"
                        >
                            <div
                                className="w-4 h-4 rounded-full border border-white shadow-sm"
                                style={{ backgroundColor: selectedColor }}
                            />
                        </button>

                        {showColorPicker && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-10">
                                <div className="grid grid-cols-4 gap-1.5">
                                    {POLL_COLORS.map((color) => (
                                        <button
                                            key={color.value}
                                            onClick={() => handleColorChange(color.value)}
                                            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${selectedColor === color.value
                                                    ? 'ring-2 ring-offset-1 ring-gray-400'
                                                    : ''
                                                }`}
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-0.5 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Question */}
            <input
                type="text"
                value={question}
                onChange={(e) => {
                    setQuestion(e.target.value);
                    updatePoll(e.target.value, options, selectedColor);
                }}
                placeholder="Ask a quick question..."
                className="w-full px-2 py-1.5 text-sm bg-white border border-gray-200 rounded focus:outline-none focus:ring-1 mb-2"
                style={{ '--tw-ring-color': `${selectedColor}60` } as React.CSSProperties}
                maxLength={200}
            />

            {/* Presets */}
            <div className="flex gap-1 mb-2">
                {QUICK_PRESETS.map((preset) => (
                    <button
                        key={preset.label}
                        onClick={() => handlePresetClick(preset)}
                        className={`px-2 py-0.5 text-xs rounded-full transition-colors`}
                        style={{
                            backgroundColor: activePreset === preset.label ? selectedColor : 'white',
                            color: activePreset === preset.label ? 'white' : '#4b5563',
                            border: activePreset === preset.label ? 'none' : '1px solid #e5e7eb'
                        }}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            {/* Options */}
            <div className="space-y-1">
                {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-1">
                        <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: selectedColor }}
                        />
                        <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-1"
                            style={{ '--tw-ring-color': `${selectedColor}60` } as React.CSSProperties}
                            maxLength={100}
                        />
                        {options.length > 2 && (
                            <button
                                onClick={() => removeOption(index)}
                                className="p-0.5 text-gray-400 hover:text-red-500"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {options.length < 4 && (
                <button
                    onClick={addOption}
                    className="flex items-center gap-1 text-xs mt-1 hover:opacity-80"
                    style={{ color: selectedColor }}
                >
                    <Plus size={12} />
                    Add option
                </button>
            )}
        </div>
    );
};
