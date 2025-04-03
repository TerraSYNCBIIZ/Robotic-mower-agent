import React, { useCallback } from 'react';

/**
 * Process a WebSocket event for the dashboard
 */
const processWebSocketEvent = useCallback((event: any) => {
  if (!event || !event.type || !event.id) return;
  
  console.log(`Processing WebSocket event: ${event.type} for mower ${event.id}`);
  
  // Find the mower in our data
  const mowerIndex = mowerData.findIndex(m => m.id === event.id);
  if (mowerIndex === -1) return;
  
  // Start with the current mower data
  const mower = { ...mowerData[mowerIndex] };
  let updated = false;
  
  // Update based on event type
  switch (event.type) {
    case 'battery-event-v2':
      if (event.attributes?.battery?.batteryPercent !== undefined) {
        mower.batteryLevel = event.attributes.battery.batteryPercent;
        updated = true;
      }
      break;
      
    case 'mower-event-v2':
      if (event.attributes?.mower) {
        // Update status based on activity and state
        const activity = event.attributes.mower.activity?.toLowerCase();
        const state = event.attributes.mower.state?.toLowerCase();
        
        if (activity) {
          if (activity === 'mowing') {
            mower.status = 'mowing';
          } else if (activity === 'charging') {
            mower.status = 'charging';
          } else if (activity === 'parked_in_cs') {
            mower.status = 'parked';
            // Check if battery is less than 100% to determine if charging while parked
            mower.isChargingWhileParked = mower.batteryLevel < 100;
          } else if (activity === 'going_home') {
            mower.status = 'returning';
          } else if (activity === 'leaving') {
            mower.status = 'starting';
          } else {
            mower.status = 'idle';
          }
          updated = true;
        }
        
        // Check for errors
        if (state === 'error' || state === 'fatal_error') {
          mower.status = 'error';
          if (event.attributes.mower.errorCode) {
            mower.errorMessage = `Error code: ${event.attributes.mower.errorCode}`;
          }
          updated = true;
        }
      }
      break;
      
    case 'work-area-event-v2':
      if (event.attributes?.workAreas && Array.isArray(event.attributes.workAreas)) {
        // Find work areas with progress information
        const workAreasWithProgress = event.attributes.workAreas.filter(area => 
          area && area.attributes && typeof area.attributes.progress === 'number'
        );
        
        if (workAreasWithProgress.length > 0) {
          // Calculate average progress
          const totalProgress = workAreasWithProgress.reduce(
            (sum, area) => sum + (area.attributes.progress || 0), 
            0
          );
          
          const avgProgress = Math.round(totalProgress / workAreasWithProgress.length);
          
          // Update mower with new progress information
          mower.areaComplete = `${avgProgress}%`;
          mower.workAreaProgress = workAreasWithProgress.map(area => ({
            workAreaId: area.attributes.workAreaId || parseInt(area.id, 10),
            name: area.attributes.name || `Work Area ${area.attributes.workAreaId || area.id}`,
            progress: area.attributes.progress || 0,
            lastCompleted: area.attributes.lastTimeCompleted
          }));
          
          console.log(`Updated area completion for mower ${mower.id} via WebSocket: ${mower.areaComplete}`);
          updated = true;
        }
      }
      break;
      
    case 'planner-event-v2':
      if (event.attributes?.planner?.nextStartTimestamp) {
        // Convert timestamp to readable time
        const nextStart = new Date(event.attributes.planner.nextStartTimestamp * 1000);
        const now = new Date();
        
        // Only show time if it's today or tomorrow
        if (nextStart.getDate() === now.getDate() && 
            nextStart.getMonth() === now.getMonth() && 
            nextStart.getFullYear() === now.getFullYear()) {
          // Today
          mower.nextStartTime = `Today at ${nextStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (nextStart.getDate() === now.getDate() + 1 && 
                  nextStart.getMonth() === now.getMonth() && 
                  nextStart.getFullYear() === now.getFullYear()) {
          // Tomorrow
          mower.nextStartTime = `Tomorrow at ${nextStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
          // Another day
          mower.nextStartTime = nextStart.toLocaleDateString([], {weekday: 'short'}) + 
                               ` at ${nextStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
        updated = true;
      }
      break;
      
    // Other event types can be handled here
  }
  
  // Update the mower data if changes were made
  if (updated) {
    // Create new mowerData array with updated mower
    const newMowerData = [...mowerData];
    newMowerData[mowerIndex] = {
      ...mower,
      lastUpdated: new Date(),
      dataSource: 'websocket'
    };
    
    setMowerData(newMowerData);
    setLastEvent(event);
  }
}, [mowerData, setMowerData]); 