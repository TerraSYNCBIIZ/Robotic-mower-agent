'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { MdAutoAwesome, MdDevices, MdSchedule } from "react-icons/md";
import { FaRobot } from "react-icons/fa";
import { BiMap } from "react-icons/bi";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-background to-muted/30">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">Robotic Mower Agent</h1>
                  <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                    Your intelligent assistant for managing robotic lawn mowers. Visualize, control, and optimize your lawn care with AI-powered recommendations.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                    <Link href="/dashboard">
                      Get Started
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-4 border rounded-lg p-8 bg-background shadow-sm">
                <Tabs defaultValue="features" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="features">Features</TabsTrigger>
                    <TabsTrigger value="about">About</TabsTrigger>
                  </TabsList>
                  <TabsContent value="features" className="space-y-4 pt-4">
                    <div className="grid gap-4">
                      <div className="flex items-start gap-4">
                        <MdDevices className="h-6 w-6 text-primary" />
                        <div className="space-y-1">
                          <h3 className="font-medium">Mower Dashboard</h3>
                          <p className="text-sm text-muted-foreground">View all your robotic mowers in one unified dashboard.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <BiMap className="h-6 w-6 text-primary" />
                        <div className="space-y-1">
                          <h3 className="font-medium">Mapping & Zones</h3>
                          <p className="text-sm text-muted-foreground">Create and manage mowing zones on an interactive map.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <MdSchedule className="h-6 w-6 text-primary" />
                        <div className="space-y-1">
                          <h3 className="font-medium">Smart Scheduling</h3>
                          <p className="text-sm text-muted-foreground">Optimize mowing times with weather-aware scheduling.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <MdAutoAwesome className="h-6 w-6 text-primary" />
                        <div className="space-y-1">
                          <h3 className="font-medium">AI Recommendations</h3>
                          <p className="text-sm text-muted-foreground">Get AI-powered insights to improve your lawn care.</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="about" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">About the Project</h3>
                      <p className="text-sm text-muted-foreground">
                        The Robotic Mower Agent is a smart management platform designed to help you get the most out of your lawn care equipment. Using advanced AI technology, it provides recommendations, scheduling, and maintenance guidance.
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="font-medium">Technology</h3>
                      <p className="text-sm text-muted-foreground">
                        Built with Next.js, React, and AI integration for smarter lawn management.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
} 