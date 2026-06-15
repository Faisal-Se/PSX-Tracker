"use client";

import { Badge } from "@/components/ui/badge";
import {
  Info,
  Briefcase,
  Layers,
  TrendingUp,
  Eye,
  BarChart3,
  ArrowLeftRight,
  ExternalLink,
  Code2,
  Star,
} from "lucide-react";

const features = [
  { label: "Portfolio Management", icon: Briefcase },
  { label: "Model Portfolios", icon: Layers },
  { label: "Market Data", icon: TrendingUp },
  { label: "Watchlist", icon: Eye },
  { label: "Analytics", icon: BarChart3 },
  { label: "Transaction History", icon: ArrowLeftRight },
];

const techStack = [
  "Next.js",
  "React",
  "React Native",
  "iOS",
  "Android",
  "TypeScript",
  "Tailwind CSS",
  "Python",
  "AI / Agentic",
  "Google Drive API",
  "Google OAuth 2.0",
];

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page Header */}
      <div className="flex items-center gap-3 animate-in-up">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card">
          <Info className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">About</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Learn more about PSX Tracker
          </p>
        </div>
      </div>

      {/* App Info */}
      <div className="border border-border bg-card rounded-xl p-6 animate-in-up-delay-1">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl border border-border bg-card flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-primary" strokeWidth={2.25} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                PSX Tracker
              </h2>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                v1.0.0
              </Badge>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mt-4">
          A comprehensive Pakistan Stock Exchange portfolio tracker for managing
          investments, model portfolios, and market analysis.
        </p>
      </div>

      {/* Features */}
      <div className="border border-border bg-card rounded-xl p-6 animate-in-up-delay-2">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Features</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {features.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2.5 p-3 rounded-lg border border-border"
            >
              <feature.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Developer */}
        <div className="border border-border bg-card rounded-xl p-6 animate-in-up-delay-3">
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Developer</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl border border-border bg-card flex items-center justify-center text-primary font-bold text-lg shrink-0">
              F
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Faisal Qayyum</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full-Stack &amp; Mobile Developer
              </p>
              <a
                href="https://www.instagram.com/faisiheree/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:underline transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Instagram
              </a>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="border border-border bg-card rounded-xl p-6 animate-in-up-delay-3">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Tech Stack</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <Badge
                key={tech}
                variant="secondary"
                className="px-3 py-1.5 text-xs font-medium"
              >
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
