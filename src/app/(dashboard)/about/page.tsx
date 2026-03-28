"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  { label: "Portfolio Management", icon: Briefcase, color: "emerald" },
  { label: "Model Portfolios", icon: Layers, color: "violet" },
  { label: "Market Data", icon: TrendingUp, color: "blue" },
  { label: "Watchlist", icon: Eye, color: "amber" },
  { label: "Analytics", icon: BarChart3, color: "cyan" },
  { label: "Transaction History", icon: ArrowLeftRight, color: "rose" },
];

const techStack = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Prisma",
  "SQLite",
];

const colorMap: Record<string, { iconBg: string; iconText: string }> = {
  emerald: { iconBg: "icon-bg-emerald", iconText: "text-emerald-500" },
  violet: { iconBg: "bg-violet-500/10", iconText: "text-violet-500" },
  blue: { iconBg: "icon-bg-blue", iconText: "text-blue-500" },
  amber: { iconBg: "bg-amber-500/10", iconText: "text-amber-500" },
  cyan: { iconBg: "bg-cyan-500/10", iconText: "text-cyan-500" },
  rose: { iconBg: "bg-rose-500/10", iconText: "text-rose-500" },
};

export default function AboutPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-end justify-between animate-in-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">About</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Learn more about PSX Tracker
          </p>
        </div>
      </div>

      {/* App Info */}
      <Card className="border-border/50 shadow-sm rounded-2xl animate-in-up-delay-1">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <CardTitle className="text-xl">PSX Tracker</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold"
                >
                  v1.0.0
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A comprehensive Pakistan Stock Exchange portfolio tracker for
            managing investments, model portfolios, and market analysis.
          </p>
        </CardContent>
      </Card>

      {/* Features */}
      <Card className="border-border/50 shadow-sm rounded-2xl animate-in-up-delay-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl icon-bg-emerald flex items-center justify-center">
              <Star className="h-5 w-5 text-emerald-500" />
            </div>
            <CardTitle className="text-base">Features</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {features.map((feature) => {
              const colors = colorMap[feature.color];
              return (
                <div
                  key={feature.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50"
                >
                  <div
                    className={`h-9 w-9 rounded-lg ${colors.iconBg} flex items-center justify-center shrink-0`}
                  >
                    <feature.icon
                      className={`h-4.5 w-4.5 ${colors.iconText}`}
                    />
                  </div>
                  <span className="text-sm font-medium">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Developer */}
        <Card className="border-border/50 shadow-sm rounded-2xl animate-in-up-delay-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Code2 className="h-5 w-5 text-violet-500" />
              </div>
              <CardTitle className="text-base">Developer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400/25 to-cyan-400/25 flex items-center justify-center text-emerald-500 font-bold text-lg shrink-0">
                F
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Faisal Qayyum</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Creator & Developer
                </p>
                <a
                  href="https://www.instagram.com/faisiheree/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-pink-500 hover:text-pink-400 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Instagram
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card className="border-border/50 shadow-sm rounded-2xl animate-in-up-delay-3">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl icon-bg-blue flex items-center justify-center">
                <Info className="h-5 w-5 text-blue-500" />
              </div>
              <CardTitle className="text-base">Tech Stack</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
