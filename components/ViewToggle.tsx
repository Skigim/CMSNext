import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { LayoutGrid, Table } from "lucide-react";

interface ViewToggleProps {
  view: 'cards' | 'table';
  onViewChange: (view: 'cards' | 'table') => void;
  className?: string;
}

export function ViewToggle({ view, onViewChange, className = '' }: ViewToggleProps) {
  return (
    <TooltipProvider>
      <div className={`flex border rounded-md ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={view === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('cards')}
              className="h-8 px-2 rounded-r-none border-r-0"
            >
              <LayoutGrid className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Card View</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={view === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('table')}
              className="h-8 px-2 rounded-l-none"
            >
              <Table className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Table View</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}