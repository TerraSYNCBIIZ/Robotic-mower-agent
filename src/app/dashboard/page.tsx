'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { MowerCard } from '@/components/dashboard/MowerCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Map, ChevronDown, Filter, Grid, List, Plus, Settings, Tag } from 'lucide-react';
import { useMowerData } from '@/contexts/MowerDataContext';
import { WebSocketStatus } from '@/components/dashboard/ConnectionStatusIcons';
import { ConnectionStatusIcons } from '@/components/dashboard/ConnectionStatusIcons';

// Define mower status type
export type MowerStatus = 'mowing' | 'charging' | 'idle' | 'error' | 'offline' | 'returning' | 'parked' | 'online' | 'paused' | 'leaving';

// Define status filters
export const STATUS_FILTERS = [
  { id: 'all', name: 'All' },
  { id: 'mowing', name: 'Mowing' },
  { id: 'charging', name: 'Charging' },
  { id: 'parked', name: 'Parked' },
  { id: 'idle', name: 'Idle' },
  { id: 'returning', name: 'Returning' },
  { id: 'online', name: 'Online' },
  { id: 'paused', name: 'Paused' },
  { id: 'error', name: 'Error' },
  { id: 'offline', name: 'Offline' }
];

// Define Category type
export interface Category {
  id: string;
  name: string;
  color: string;
}

export default function DashboardPage() {
  const { mowers, refreshMowerData, isLoading, lastUpdateTime, dataSource } = useMowerData();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedMower, setSelectedMower] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([
    { id: 'zone1', name: 'Front Yard', color: '#3b82f6' },
    { id: 'zone2', name: 'Back Yard', color: '#ef4444' },
    { id: 'zone3', name: 'Side Garden', color: '#f59e0b' }
  ]);

  // Refresh mower data
  const handleRefresh = async () => {
    if (isLoading) return;
    
    try {
      const loadingToast = toast.loading('Refreshing mower data...');
      await refreshMowerData();
      toast.dismiss(loadingToast);
      
      toast.success('Mower data refreshed');
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error('Failed to refresh data');
    }
  };
  
  // Filter mowers based on selected status and category
  const filteredMowers = mowers.filter(mower => 
    (statusFilter === 'all' || mower.status === statusFilter) &&
    (selectedCategory === 'all')
  );

  // Format last update time
  const formatLastUpdateTime = () => {
    if (!lastUpdateTime) return 'Never';
    return lastUpdateTime.toLocaleTimeString();
  };

  // Data source info for UI
  const getDataSourceText = () => {
    switch (dataSource) {
      case 'firebase':
        return 'Real-time data';
      case 'api':
        return 'API data';
      default:
        return 'Sample data';
    }
  };

  // WebSocket connection status
  const getWebSocketStatus = () => {
    // In a real app, you'd check the actual connection status
    // For now, assume connected if using Firebase
    return dataSource === 'firebase' ? WebSocketStatus.CONNECTED : WebSocketStatus.DISCONNECTED;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mower Dashboard</h1>
          <p className="text-muted-foreground">
            {mowers.length} mowers available • Last updated: {formatLastUpdateTime()} • {getDataSourceText()}
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <ConnectionStatusIcons
            apiConnected={true}
            websocketStatus={getWebSocketStatus()}
          />
          
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter
            <ChevronDown className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none px-3"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none px-3"
              onClick={() => setViewMode('map')}
            >
              <Map className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="gap-2"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Filters section (expandable) */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Filter Mowers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Status</h4>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map(filter => (
                    <Button
                      key={filter.id}
                      variant={statusFilter === filter.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(filter.id)}
                      className="min-w-20"
                    >
                      {filter.name}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Tag className="h-4 w-4 mr-1" />
                  Work Areas
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedCategory === 'all' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory('all')}
                  >
                    All Areas
                  </Button>
                  
                  {categories.map(category => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      className="flex items-center gap-1.5"
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Tabs for view modes */}
      <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as 'grid' | 'map')} className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <Grid className="h-4 w-4" />
            Grid View
          </TabsTrigger>
          <TabsTrigger value="map" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Map View
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="grid">
          {/* Mower grid */}
          {filteredMowers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMowers.map((mower) => (
                <MowerCard
                  key={mower.id}
                  name={mower.name}
                  status={(mower.status || 'idle') as MowerStatus}
                  batteryLevel={mower.batteryLevel}
                  areaComplete={mower.areaComplete || "0%"}
                  nextMaintenance={30}
                  id={mower.id}
                  onSelect={(id) => setSelectedMower(id)}
                  lastUpdated={mower.lastSeen}
                  dataSource="firebase"
                  categories={categories}
                  nextStartTime={mower.nextStartTime || "Unknown"}
                  isConnected={mower.connected}
                />
              ))}
              
              {/* Add mower card - for visual completeness */}
              <Card className="overflow-hidden border-dashed border-2 border-border h-full flex items-center justify-center cursor-pointer hover:bg-accent/20 transition-colors">
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="h-12 w-12 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Add Mower</h3>
                  <p className="text-center text-sm text-muted-foreground">
                    Connect a new robotic mower to your system
                  </p>
                </div>
              </Card>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-xl text-muted-foreground">No mowers found matching the current filter</p>
              {statusFilter !== 'all' && (
                <Button 
                  variant="link" 
                  onClick={() => setStatusFilter('all')}
                  className="mt-2"
                >
                  Show all mowers
                </Button>
              )}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="map">
          <div className="bg-secondary/20 rounded-lg border border-border h-[500px] flex items-center justify-center">
            <div className="text-center">
              <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Map View</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The interactive map view will show your mowers' locations and work areas.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Dashboard Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">API Status</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  Connected
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">WebSocket</span>
                <Badge 
                  variant="outline" 
                  className={dataSource === 'firebase' 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-red-500/10 text-red-500 border-red-500/20"
                  }
                >
                  {dataSource === 'firebase' ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Sync</span>
                <span className="text-sm">{formatLastUpdateTime()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Data Source</span>
                <span className="text-sm">{getDataSourceText()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Mower Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Mowers</span>
                <span className="text-sm">{mowers.filter(m => m.status === 'mowing').length} of {mowers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Charging</span>
                <span className="text-sm">{mowers.filter(m => m.status === 'charging').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Connected</span>
                <span className="text-sm">{mowers.filter(m => m.connected).length} of {mowers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Offline</span>
                <span className="text-sm">{mowers.filter(m => !m.connected || m.status === 'offline').length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Weather Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">Weather data not available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 