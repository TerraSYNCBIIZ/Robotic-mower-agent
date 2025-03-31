import type { ReactNode } from "react";
import { Calendar, AlertTriangle, Settings, BarChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BsFileBarGraph } from "react-icons/bs";
import { cn } from "@/lib/utils";

interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  icon: ReactNode;
  requiresMower: boolean;
}

interface PromptTemplatesProps {
  onTemplateSelect: (template: PromptTemplate) => void;
  hasMowerContext?: boolean;
}

export function PromptTemplates({
  onTemplateSelect,
  hasMowerContext = false,
}: PromptTemplatesProps) {
  // Define prompt templates
  const promptTemplates: PromptTemplate[] = [
    {
      id: 'schedule-analysis',
      title: 'Optimize Mowing Schedule',
      prompt: 'Create an optimal mowing schedule based on weather, lawn growth rate, and battery efficiency.',
      icon: <Calendar className="h-5 w-5" />,
      requiresMower: true
    },
    {
      id: 'diagnostics',
      title: 'Run Mower Diagnostics',
      prompt: 'Run diagnostics on my mower. Check for errors and suggest performance improvements.',
      icon: <AlertTriangle className="h-5 w-5" />,
      requiresMower: true
    },
    {
      id: 'property-analysis',
      title: 'Property Area Analysis',
      prompt: 'Analyze my lawn for optimal mower settings. Check size, terrain, obstacles, and boundaries.',
      icon: <BsFileBarGraph className="h-5 w-5" />,
      requiresMower: true
    },
    {
      id: 'maintenance-tips',
      title: 'Maintenance Tips',
      prompt: 'What maintenance should I perform on my robotic mower to keep it working properly?',
      icon: <Settings className="h-5 w-5" />,
      requiresMower: false
    },
    {
      id: 'efficiency-report',
      title: 'Efficiency Report',
      prompt: 'Create an efficiency report for my mower. How can I improve battery life and cutting performance?',
      icon: <BarChart className="h-5 w-5" />,
      requiresMower: true
    }
  ];

  // Show all templates instead of filtering
  const displayTemplates = promptTemplates;

  const handleTemplateClick = (template: PromptTemplate) => {
    onTemplateSelect(template);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl mx-auto">
      {displayTemplates.map((template) => (
        <button
          key={template.id}
          type="button"
          className={cn(
            "text-left p-4 rounded-lg relative border transition-all duration-200",
            "hover:shadow-md group overflow-hidden",
            "border-border bg-card hover:border-primary/50 hover:bg-accent"
          )}
          onClick={() => handleTemplateClick(template)}
        >
          <div className="flex items-start gap-3 relative z-10">
            <div className={cn(
              "flex-shrink-0 p-2 rounded-md bg-primary/10 text-primary",
              "group-hover:bg-primary/20 group-hover:scale-110 transition-transform"
            )}>
              {template.icon}
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm">{template.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 pr-2">
                {template.prompt}
              </p>
              {template.requiresMower && (
                <span className="text-xs inline-flex items-center mt-2 text-amber-500 font-medium gap-1">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="12" 
                    height="12" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Use @ to tag a mower
                </span>
              )}
            </div>
          </div>
          
          <div className={cn(
            "absolute bottom-0 left-0 right-0 h-1 transform scale-x-0 group-hover:scale-x-100",
            "transition-transform duration-300 origin-left",
            template.requiresMower ? "bg-primary/60" : "bg-secondary/60"
          )}/>
        </button>
      ))}
    </div>
  );
} 