'use client'

import React, { useState } from 'react'
import { Calendar, LayoutList, Target, FileText } from 'lucide-react'
import { CalendarView } from './SocialMediaDashboard/CalendarView'
import { WeeklyGoals } from './SocialMediaDashboard/WeeklyGoals'
import { TemplatesView } from './SocialMediaDashboard/TemplatesView'
import { KanbanBoard } from './WorkboardKanban'

export default function SocialMediaDashboard() {
  const [activeTab, setActiveTab] = useState('calendar')
  
  return (
    <div className="social-media-dashboard" data-section="social-media">
      <nav className="social-media-dashboard__tabs">
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'calendar' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={14} /> Calendar
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'workboard' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('workboard')}
        >
          <LayoutList size={14} /> Workboard
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'goals' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('goals')}
        >
          <Target size={14} /> Weekly Goals
        </button>
        
        <button 
          className={`social-media-dashboard__tab ${activeTab === 'templates' ? 'social-media-dashboard__tab--active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <FileText size={14} /> Templates
        </button>
      </nav>
      
      <div className="social-media-dashboard__content">
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'workboard' && <KanbanBoard department="social-media" title="Social Media Workboard" />}
        {activeTab === 'goals' && <WeeklyGoals />}
        {activeTab === 'templates' && <TemplatesView />}
      </div>
    </div>
  )
}
