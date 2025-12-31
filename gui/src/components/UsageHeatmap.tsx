import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface HeatmapDay {
  date: string;
  requests: number;
  level: number;
}

export default function UsageHeatmap() {
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    try {
      const response = await fetch('/api/analytics/heatmap?days=365');
      const data = await response.json();
      if (data.success) {
        setHeatmapData(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to fetch heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getColorForLevel = (level: number) => {
    const colors = [
      'bg-base-300',     // 0 - no activity
      'bg-success/30',   // 1 - low
      'bg-success/50',   // 2 - medium-low
      'bg-success/70',   // 3 - medium-high
      'bg-success',      // 4 - high
    ];
    return colors[level] || colors[0];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getWeeksData = () => {
    // Group days into weeks (7 days per week)
    const weeks: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];

    // Fill in missing days with empty data
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const dataMap = new Map(heatmapData.map(d => [d.date, d]));

    for (let i = 0; i < 365; i++) {
      const date = new Date(oneYearAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = dataMap.get(dateStr) || {
        date: dateStr,
        requests: 0,
        level: 0,
      };

      currentWeek.push(dayData);

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const weeks = getWeeksData();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (loading) {
    return (
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Activity Heatmap</h2>
          <div className="flex justify-center items-center h-40">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
          <h2 className="card-title">Activity Heatmap (Last 365 Days)</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-base-content/60">Less</span>
            {[0, 1, 2, 3, 4].map(level => (
              <div
                key={level}
                className={`w-3 h-3 rounded-sm ${getColorForLevel(level)}`}
              />
            ))}
            <span className="text-base-content/60">More</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Month labels */}
            <div className="flex gap-0.5 mb-2 text-xs text-base-content/60 ml-8">
              {months.map((month, idx) => (
                <div
                  key={idx}
                  className="flex-1 text-left"
                  style={{ minWidth: '40px' }}
                >
                  {month}
                </div>
              ))}
            </div>

            {/* Day labels and heatmap grid */}
            <div className="flex gap-1">
              {/* Day of week labels */}
              <div className="flex flex-col gap-0.5 text-xs text-base-content/60 justify-around pr-2">
                <div>Mon</div>
                <div>Wed</div>
                <div>Fri</div>
              </div>

              {/* Heatmap grid */}
              <div className="flex gap-0.5">
                {weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-0.5">
                    {week.map((day, dayIdx) => (
                      <motion.div
                        key={`${weekIdx}-${dayIdx}`}
                        className={`w-3 h-3 rounded-sm cursor-pointer ${getColorForLevel(day.level)}`}
                        whileHover={{ scale: 1.3 }}
                        onMouseEnter={(e) => {
                          setHoveredDay(day);
                          setMousePos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={(e) => {
                          setMousePos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredDay && (
          <div
            className="fixed z-50 bg-base-100 shadow-lg rounded-lg p-3 text-sm border border-base-300 pointer-events-none"
            style={{
              left: `${mousePos.x + 10}px`,
              top: `${mousePos.y + 10}px`,
            }}
          >
            <div className="font-semibold">{formatDate(hoveredDay.date)}</div>
            <div className="text-base-content/70">
              {hoveredDay.requests === 0
                ? 'No requests'
                : `${hoveredDay.requests} request${hoveredDay.requests > 1 ? 's' : ''}`
              }
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-base-content/60 text-center">
          Learn how we count contributions
        </div>
      </div>
    </div>
  );
}
