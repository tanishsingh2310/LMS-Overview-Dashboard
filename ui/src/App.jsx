import { useEffect, useState, useCallback, useRef } from "react";

import { getDashboardOverview } from "./api/dashboardApi";
import { getMetricsForEntity } from "./config/metrics";
import OverviewPage from "./pages/OverviewPage";
import EntityDetailsPage from "./pages/EntityDetailsPage";
import MetricDetailsPage from "./pages/MetricDetailsPage";
import UserCoursesPage from "./pages/UserCoursesPage";
import UniversityStaffPage from "./pages/UniversityStaffPage";
import "./index.css";

const STORAGE_KEY = "universityDashboardNavigation";

export default function App() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedUserCourses, setSelectedUserCourses] = useState(null);
  const [selectedStaffType, setSelectedStaffType] = useState(null);

  const isMounted = useRef(false);
  const navigationRestored = useRef(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const result = await getDashboardOverview();
      const schools = Array.isArray(result) ? result : result.schools;

      if (!Array.isArray(schools)) {
        throw new Error("The Moodle overview response has no schools array.");
      }

      if (!isMounted.current) return;

      setEntities(schools);

      // Restore saved navigation before enabling state saving.
      if (!navigationRestored.current) {
        let saved = null;

        try {
          const navigationEntry = performance.getEntriesByType("navigation")[0];
const isBrowserReload = navigationEntry?.type === "reload";

if (isBrowserReload) {
  saved = JSON.parse(
    sessionStorage.getItem(STORAGE_KEY) || "null"
  );
} else {
  // A fresh visit to the dashboard should start at Overview.
  sessionStorage.removeItem(STORAGE_KEY);
}
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }

        if (saved?.entityId != null) {
          const entity = schools.find(
            (item) => String(item.id) === String(saved.entityId)
          );

          if (entity) {
            setSelectedEntity(entity);

            if (saved.staffType) {
              setSelectedStaffType(saved.staffType);
            } else if (saved.metricKey) {
              const metrics = getMetricsForEntity(entity);
              const metric = metrics.find(
                (item) => item.key === saved.metricKey
              );

              if (metric) {
                if (metric.key === "visitingFaculty") {
                  setSelectedStaffType("visitingFaculty");
                } else if (metric.key === "labInstructors") {
                  setSelectedStaffType("labInstructor");
                } else {
                  setSelectedMetric(metric);
                }
              }
            }
          }
        }

        // Allow saving only after restoration has been attempted.
        navigationRestored.current = true;
      }
    } catch (error) {
      if (isMounted.current) {
        setLoadError(
          error.message || "Unable to load dashboard data."
        );
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Load once when the dashboard mounts; no automatic refresh.
  useEffect(() => {
    isMounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOverview();

    return () => {
      isMounted.current = false;
    };
  }, [loadOverview]);
// Clear saved navigation when leaving this dashboard document.
// A browser reload is handled separately so the current page can restore.
useEffect(() => {
  const handlePageShow = (event) => {
    if (event.persisted) {
      // The browser restored this page from its back-forward cache.
      sessionStorage.removeItem(STORAGE_KEY);

      setSelectedEntity(null);
      setSelectedMetric(null);
      setSelectedUserCourses(null);
      setSelectedStaffType(null);
    }
  };

  window.addEventListener("pageshow", handlePageShow);

  return () => {
    window.removeEventListener("pageshow", handlePageShow);
  };
}, []);
  // Save navigation only after initial restoration has been attempted.
  // Save the current page only when a dashboard subpage is open.
useEffect(() => {
  if (!navigationRestored.current) return;

  // Overview should not retain an older subpage.
  if (
    !selectedEntity &&
    !selectedMetric &&
    !selectedUserCourses &&
    !selectedStaffType
  ) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  const navigation = {
    entityId: selectedEntity?.id ?? null,
    metricKey: selectedMetric?.key ?? null,
    staffType: selectedStaffType,
    userId: selectedUserCourses?.user?.id ?? null,
    userType: selectedUserCourses?.userType ?? null,
  };

  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(navigation)
    );
  } catch (error) {
    console.error("Could not save dashboard navigation:", error);
  }
}, [
  selectedEntity,
  selectedMetric,
  selectedStaffType,
  selectedUserCourses,
]);

  // Scroll to the top when the displayed view changes.
  const currentViewKey = selectedUserCourses
    ? `user-courses-${selectedUserCourses.user.id}`
    : selectedStaffType
      ? `staff-${selectedStaffType}`
      : selectedMetric && selectedEntity
        ? `metric-${selectedEntity.id}-${selectedMetric.key}`
        : selectedEntity
          ? `entity-${selectedEntity.id}`
          : "overview";

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [currentViewKey]);

  function showOverview() {
    sessionStorage.removeItem(STORAGE_KEY);
    setSelectedEntity(null);
    setSelectedMetric(null);
    setSelectedUserCourses(null);
    setSelectedStaffType(null);
  }

  function showEntityDetails(entity) {
    setSelectedEntity(entity);
    setSelectedMetric(null);
    setSelectedUserCourses(null);
    setSelectedStaffType(null);
  }

  function showMetricDetails(entity, metric) {
    setSelectedEntity(entity);
    setSelectedUserCourses(null);

    if (
      metric.key === "visitingFaculty" ||
      metric.key === "labInstructors"
    ) {
      setSelectedMetric(null);
      setSelectedStaffType(
        metric.key === "visitingFaculty"
          ? "visitingFaculty"
          : "labInstructor"
      );
      return;
    }

    setSelectedMetric(metric);
    setSelectedStaffType(null);
  }

  function showUserCourses(user, userType) {
    setSelectedUserCourses({ user, userType });
    setSelectedStaffType(null);
  }

  function showUniversityStaff(staffType) {
    setSelectedStaffType(staffType);
    setSelectedUserCourses(null);
  }

  function backToEntityDetails() {
    setSelectedMetric(null);
    setSelectedUserCourses(null);
    setSelectedStaffType(null);
  }

  if (loading) {
    return (
      <div className="university-dashboard" role="status">
        <p>Loading...</p>
      </div>
    );
  }

  if (loadError && entities.length === 0) {
    return (
      <main className="university-dashboard" role="alert">
        <h1>Unable to load dashboard</h1>
        <p>{loadError}</p>
        <button type="button" onClick={loadOverview}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className="university-dashboard">
      {loadError && (
        <p role="status">
          Unable to load dashboard data. Please refresh the page to try again.
        </p>
      )}

      {!selectedEntity ? (
        <OverviewPage
          entities={entities}
          onSelect={showEntityDetails}
        />
      ) : selectedUserCourses ? (
        <UserCoursesPage
          user={selectedUserCourses.user}
          userType={selectedUserCourses.userType}
          onBack={() => setSelectedUserCourses(null)}
        />
      ) : selectedStaffType ? (
        <UniversityStaffPage
          staffType={selectedStaffType}
          entities={entities}
          onBack={() => setSelectedStaffType(null)}
        />
      ) : selectedMetric ? (
        <MetricDetailsPage
          key={`${selectedEntity.shortname}-${selectedMetric.key}`}
          entity={selectedEntity}
          metric={selectedMetric}
          onBack={backToEntityDetails}
          onUserCoursesSelect={showUserCourses}
          onUniversityStaffSelect={showUniversityStaff}
        />
      ) : (
        <EntityDetailsPage
          entity={selectedEntity}
          onBack={showOverview}
          onMetricSelect={showMetricDetails}
        />
      )}
    </div>
  );
}
