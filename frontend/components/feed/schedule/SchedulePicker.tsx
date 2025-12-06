'use client';

import React, { useState } from 'react';
import { Calendar, Clock, X, Check, ChevronRight } from 'lucide-react';
import { format, addHours, addDays, setHours, setMinutes, isBefore, startOfHour } from 'date-fns';

interface SchedulePickerProps {
    onSchedule: (date: Date | null) => void;
    onClose: () => void;
    initialDate?: Date | null;
    onViewScheduled?: () => void;
}

const QUICK_OPTIONS = [
    { label: 'In 1 hour', getValue: () => addHours(startOfHour(new Date()), 2) },
    { label: 'In 3 hours', getValue: () => addHours(startOfHour(new Date()), 4) },
    { label: 'Tomorrow 9 AM', getValue: () => setMinutes(setHours(addDays(new Date(), 1), 9), 0) },
    { label: 'Tomorrow 6 PM', getValue: () => setMinutes(setHours(addDays(new Date(), 1), 18), 0) },
];

export const SchedulePicker: React.FC<SchedulePickerProps> = ({
    onSchedule,
    onClose,
    initialDate,
    onViewScheduled
}) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate || null);
    const [showCustom, setShowCustom] = useState(false);
    const [dateInput, setDateInput] = useState('');
    const [timeInput, setTimeInput] = useState('');

    const handleQuickSelect = (getValue: () => Date) => {
        setSelectedDate(getValue());
        setShowCustom(false);
    };

    const handleConfirm = () => {
        onSchedule(selectedDate);
        onClose();
    };

    const handleClear = () => {
        setSelectedDate(null);
        onSchedule(null);
        onClose();
    };

    const handleCustomDateTime = (d: string, t: string) => {
        if (d && t) {
            const date = new Date(`${d}T${t}`);
            if (!isNaN(date.getTime()) && !isBefore(date, new Date())) {
                setSelectedDate(date);
            }
        }
    };

    const minDate = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-5 w-80 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <div className="bg-black text-white p-1.5 rounded-lg">
                        <Calendar size={16} />
                    </div>
                    <span className="font-semibold text-gray-900">Schedule Post</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Quick Options */}
            {!showCustom && (
                <div className="space-y-2 mb-4">
                    <div className="grid grid-cols-1 gap-2">
                        {QUICK_OPTIONS.map((option) => {
                            const optionDate = option.getValue();
                            const isSelected = selectedDate &&
                                format(selectedDate, 'yyyy-MM-dd HH:mm') === format(optionDate, 'yyyy-MM-dd HH:mm');

                            return (
                                <button
                                    key={option.label}
                                    onClick={() => handleQuickSelect(option.getValue)}
                                    className={`
                                        w-full px-4 py-2.5 text-sm rounded-xl border text-left transition-all flex items-center justify-between group
                                        ${isSelected
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                        }
                                    `}
                                >
                                    <span>{option.label}</span>
                                    {isSelected && <Check size={14} />}
                                    {!isSelected && <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 text-gray-400" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Custom Date Time Selection */}
            {showCustom && (
                <div className="mb-4 space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date</label>
                        <input
                            type="date"
                            min={minDate}
                            value={dateInput}
                            onChange={(e) => {
                                setDateInput(e.target.value);
                                handleCustomDateTime(e.target.value, timeInput);
                            }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Time</label>
                        <input
                            type="time"
                            value={timeInput}
                            onChange={(e) => {
                                setTimeInput(e.target.value);
                                handleCustomDateTime(dateInput, e.target.value);
                            }}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                        />
                    </div>
                </div>
            )}

            {/* Toggle Custom/Quick */}
            <div className="mb-5">
                <button
                    onClick={() => setShowCustom(!showCustom)}
                    className="text-xs font-medium text-gray-500 hover:text-black underline decoration-gray-300 underline-offset-4 hover:decoration-black transition-all"
                >
                    {showCustom ? 'Back to quick options' : 'Pick a custom date & time'}
                </button>
            </div>

            {/* Selected Preview */}
            {selectedDate && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                    <div className="text-xs text-gray-500 font-medium mb-1">Scheduled for:</div>
                    <div className="text-sm font-semibold text-gray-900">
                        {format(selectedDate, 'EEEE, MMMM d')}
                    </div>
                    <div className="text-sm text-gray-600">
                        @ {format(selectedDate, 'h:mm a')}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mb-4">
                {selectedDate && (
                    <button
                        onClick={handleClear}
                        className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        Clear
                    </button>
                )}
                <button
                    onClick={handleConfirm}
                    disabled={!selectedDate}
                    className={`
                        flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm
                        ${selectedDate
                            ? 'bg-black text-white hover:bg-gray-800 hover:shadow-md transform hover:-translate-y-0.5'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                    `}
                >
                    <Check size={16} />
                    Confirm Schedule
                </button>
            </div>

            {/* View Scheduled Posts Option */}
            <div className="pt-3 border-t border-gray-100 flex justify-center">
                <button
                    onClick={() => {
                        if (onViewScheduled) onViewScheduled();
                    }}
                    className="text-xs text-gray-500 hover:text-black flex items-center gap-1.5 transition-colors group"
                >
                    <Clock size={12} className="group-hover:scale-110 transition-transform" />
                    View scheduled posts
                </button>
            </div>
        </div>
    );
};
