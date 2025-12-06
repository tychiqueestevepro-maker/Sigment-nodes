'use client';

import React, { useState } from 'react';
import { X, Plus, BarChart3, GripVertical, Clock, Palette } from 'lucide-react';
import { CreatePollOption } from '@/types/poll';

// Poll theme colors
const POLL_COLORS = [
    { name: 'Gray', value: '#374151', bg: 'bg-gray-700' },
    { name: 'Blue', value: '#3B82F6', bg: 'bg-blue-500' },
    { name: 'Purple', value: '#8B5CF6', bg: 'bg-purple-500' },
    { name: 'Pink', value: '#EC4899', bg: 'bg-pink-500' },
    { name: 'Red', value: '#EF4444', bg: 'bg-red-500' },
    { name: 'Orange', value: '#F97316', bg: 'bg-orange-500' },
    { name: 'Yellow', value: '#EAB308', bg: 'bg-yellow-500' },
    { name: 'Green', value: '#22C55E', bg: 'bg-green-500' },
    { name: 'Teal', value: '#14B8A6', bg: 'bg-teal-500' },
];

interface PollCreatorProps {
    onPollChange: (poll: {
        question: string;
        options: CreatePollOption[];
        allow_multiple: boolean;
        expires_in_hours?: number;
        color?: string;
    } | null) => void;
    onClose: () => void;
}

export const PollCreator: React.FC<PollCreatorProps> = ({ onPollChange, onClose }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [allowMultiple, setAllowMultiple] = useState(false);
    const [expiresInHours, setExpiresInHours] = useState<number | null>(null);
    const [selectedColor, setSelectedColor] = useState(POLL_COLORS[0].value);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
        updatePoll(question, newOptions, allowMultiple, expiresInHours, selectedColor);
    };

    const addOption = () => {
        if (options.length < 10) {
            const newOptions = [...options, ''];
            setOptions(newOptions);
        }
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
            updatePoll(question, newOptions, allowMultiple, expiresInHours, selectedColor);
        }
    };

    const updatePoll = (q: string, opts: string[], multi: boolean, expires: number | null, color: string) => {
        const validOptions = opts.filter(o => o.trim().length > 0);
        if (q.trim() && validOptions.length >= 2) {
            onPollChange({
                question: q.trim(),
                options: validOptions.map(text => ({ text })),
                allow_multiple: multi,
                expires_in_hours: expires || undefined,
                color: color
            });
        } else {
            onPollChange(null);
        }
    };

    const handleQuestionChange = (value: string) => {
        setQuestion(value);
        updatePoll(value, options, allowMultiple, expiresInHours, selectedColor);
    };

    const handleMultipleChange = (value: boolean) => {
        setAllowMultiple(value);
        updatePoll(question, options, value, expiresInHours, selectedColor);
    };

    const handleExpiresChange = (value: number | null) => {
        setExpiresInHours(value);
        updatePoll(question, options, allowMultiple, value, selectedColor);
    };

    const handleColorChange = (color: string) => {
        setSelectedColor(color);
        setShowColorPicker(false);
        updatePoll(question, options, allowMultiple, expiresInHours, color);
    };

    const currentColorObj = POLL_COLORS.find(c => c.value === selectedColor) || POLL_COLORS[0];

    return (
        <div
            className="rounded-xl border-2 p-4 mb-4 transition-colors"
            style={{
                borderColor: selectedColor,
                backgroundColor: `${selectedColor}08`
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2" style={{ color: selectedColor }}>
                    <BarChart3 size={18} />
                    <span className="font-medium text-sm">Create Poll</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Question */}
            <input
                type="text"
                value={question}
                onChange={(e) => handleQuestionChange(e.target.value)}
                placeholder="Ask a question..."
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 mb-4"
                style={{ '--tw-ring-color': `${selectedColor}40` } as React.CSSProperties}
                maxLength={500}
            />

            {/* Options */}
            <div className="space-y-2 mb-4">
                {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: selectedColor }}
                        />
                        <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 text-sm"
                            style={{ '--tw-ring-color': `${selectedColor}40` } as React.CSSProperties}
                            maxLength={200}
                        />
                        {options.length > 2 && (
                            <button
                                onClick={() => removeOption(index)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Add option button */}
            {options.length < 10 && (
                <button
                    onClick={addOption}
                    className="flex items-center gap-1.5 text-sm hover:opacity-80 mb-4"
                    style={{ color: selectedColor }}
                >
                    <Plus size={16} />
                    Add option
                </button>
            )}

            {/* Settings */}
            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-200">
                {/* Color picker */}
                <div className="relative">
                    <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/50 transition-colors"
                    >
                        <div
                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: selectedColor }}
                        />
                        <Palette size={14} className="text-gray-500" />
                    </button>

                    {showColorPicker && (
                        <div className="absolute left-0 bottom-full mb-2 bg-white rounded-xl shadow-lg border border-gray-200 p-3 z-10">
                            <div className="grid grid-cols-5 gap-2">
                                {POLL_COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        onClick={() => handleColorChange(color.value)}
                                        className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${selectedColor === color.value
                                                ? 'ring-2 ring-offset-2 ring-gray-400'
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

                {/* Allow multiple */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={allowMultiple}
                        onChange={(e) => handleMultipleChange(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-600">Multiple choices</span>
                </label>

                {/* Expiration */}
                <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <select
                        value={expiresInHours || ''}
                        onChange={(e) => handleExpiresChange(e.target.value ? Number(e.target.value) : null)}
                        className="text-sm bg-transparent border-none text-gray-600 focus:outline-none cursor-pointer"
                    >
                        <option value="">No expiration</option>
                        <option value="1">1 hour</option>
                        <option value="6">6 hours</option>
                        <option value="24">1 day</option>
                        <option value="72">3 days</option>
                        <option value="168">1 week</option>
                    </select>
                </div>
            </div>
        </div>
    );
};
