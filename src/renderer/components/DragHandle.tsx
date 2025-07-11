import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal } from 'lucide-react';

interface DragHandleProps {
  className?: string;
}

const DragHandle: React.FC<DragHandleProps> = ({ className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [windowStart, setWindowStart] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = async (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      const newX = windowStart.x + deltaX;
      const newY = windowStart.y + deltaY;

      await window.electronAPI.windowMove({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, windowStart]);

  const handleMouseDown = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    const [windowX, windowY] = await window.electronAPI.windowGetPosition();
    
    setDragStart({ x: e.clientX, y: e.clientY });
    setWindowStart({ x: windowX, y: windowY });
    setIsDragging(true);
    
    await window.electronAPI.windowStartDrag();
  };

  return (
    <div
      ref={dragRef}
      className={`
        flex items-center justify-center 
        cursor-grab active:cursor-grabbing
        hover:bg-gray-100 dark:hover:bg-gray-800
        transition-colors duration-150
        select-none
        ${className}
      `}
      onMouseDown={handleMouseDown}
    >
      <GripHorizontal className="w-4 h-4 text-gray-400" />
    </div>
  );
};

export default DragHandle; 