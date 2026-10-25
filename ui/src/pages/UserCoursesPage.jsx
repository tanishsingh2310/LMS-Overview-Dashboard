import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";

import {
  getStudentCourses,
  getTeacherCourses,
} from "../api/dashboardApi";

import { formatDateTime, formatNumber } from "../utils/formatters";
import StatusBadge from "../components/StatusBadge";
import SortableHeader from "../components/SortableHeader";
import { sortRowsBy } from "../utils/sorting";

const PAGE_SIZE = 10;

export default function UserCoursesPage({ user, userType, onBack }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState("fullname");
  const [sortDirection, setSortDirection] = useState("asc");

  const isStudent = userType === "student";

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setLoading(true);
      setLoadError("");

      try {
        if (!user?.id) {
          throw new Error("A valid Moodle user ID is required.");
        }

        const result = isStudent
          ? await getStudentCourses(user.id)
          : await getTeacherCourses(user.id);

        if (!cancelled) {
          setCourses(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message || "Unable to load courses.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isStudent]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses
      .filter((course) => course.visible !== false)
      .filter((course) =>
        `${course.fullname ?? ""} ${course.shortname ?? ""} ${course.categoryPath ?? ""}`
          .toLowerCase()
          .includes(query)
      );
  }, [courses, search]);

  const sortedCourses = useMemo(
    () =>
      sortRowsBy(filteredCourses, sortKey, sortDirection, {
        teachers: (course) => (course.teachers ?? []).join(" "),
        activities: (course) =>
          Object.entries(course.activities ?? {})
            .map(([name, count]) => `${name} ${count}`)
            .join(" "),
        courseLink: (course) => course.fullname ?? "",
      }),
    [filteredCourses, sortKey, sortDirection]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(sortedCourses.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const visibleCourses = sortedCourses.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function handleSort(nextKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
    } else {
      setSortKey(nextKey);
      setSortDirection("asc");
    }

    setCurrentPage(1);
  }

  function resetFilters() {
    setSearch("");
    setSortKey("fullname");
    setSortDirection("asc");
    setCurrentPage(1);
  }

  if (loading) {
    return (
      <main className="metric-details-page" role="status">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <p>Loading...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="metric-details-page" role="alert">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <h1>Unable to load courses</h1>
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setCourses([]);
            setLoadError("");
            setLoading(true);
            // Trigger the effect by remounting this page from its parent if needed.
            window.location.reload();
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="metric-details-page">
      <button
        type="button"
        className="back-button"
        onClick={onBack}
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>

      <header className="user-profile-panel">
        <div className="user-profile-main">
          <h1 className="user-profile-name">
            {user.fullname}
          </h1>
          <p className="user-profile-role">
            {isStudent
              ? `Enrollment No.: ${user.username || "—"}`
              : user.designation || user.idnumber || "Staff"}
          </p>
        </div>

        <div className="user-profile-status">
          <StatusBadge online={Boolean(user.online)} />
        </div>

        <div className="user-profile-details">
          <ProfileDetail
            label="Department"
            value={user.department}
          />
          <ProfileDetail
            label="Branch"
            value={user.institution}
          />

          {isStudent && (
            <ProfileDetail
              label="Batch"
              value={user.idnumber}
            />
          )}

          <ProfileDetail
            label={isStudent ? "Email" : "Email ID"}
            value={user.email}
          />
          <ProfileDetail
            label="Last Access"
            value={formatDateTime(user.lastAccess)}
          />
        </div>
      </header>

      <div className="section-heading-row">
        <div>
          <h2 className="metrics-section-title">
            {isStudent ? "Courses Enrolled" : "Courses Teaching"}
          </h2>
          <p className="section-description">
            {formatNumber(filteredCourses.length)} course
            {filteredCourses.length === 1 ? "" : "s"} found
          </p>
        </div>
      </div>

      <section
        className="table-toolbar"
        aria-label="Course filters"
      >
        <label className="table-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Search courses..."
            onChange={(event) => {
              setSearch(event.target.value);
              setCurrentPage(1);
            }}
          />
        </label>

        <button
          type="button"
          className="reset-filters-button"
          onClick={resetFilters}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Reset filters
        </button>
      </section>

      <div className="table-results-summary">
        Showing{" "}
        {filteredCourses.length
          ? (safePage - 1) * PAGE_SIZE + 1
          : 0}
        –{Math.min(safePage * PAGE_SIZE, filteredCourses.length)} of{" "}
        {filteredCourses.length} courses
      </div>

      <div className="course-table-wrapper">
        <table className="course-table">
          <thead>
            {isStudent ? (
              <tr>
                <SortableHeader
                  label="S.No."
                  sortKey="id"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Course Full Name"
                  sortKey="fullname"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Teacher(s)"
                  sortKey="teachers"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Course Category"
                  sortKey="categoryPath"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Last Access to Course"
                  sortKey="lastAccess"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Course Link"
                  sortKey="courseLink"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </tr>
            ) : (
              <tr>
                <SortableHeader
                  label="S.No."
                  sortKey="id"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Course Full Name"
                  sortKey="fullname"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Activities / Resources"
                  sortKey="activities"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="No. of Students"
                  sortKey="studentCount"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Last Access to Course"
                  sortKey="lastAccess"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Course Link"
                  sortKey="courseLink"
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </tr>
            )}
          </thead>

          <tbody>
            {visibleCourses.map((course, index) => (
              <tr key={course.id}>
                <td>
                  {(safePage - 1) * PAGE_SIZE + index + 1}
                </td>
                <td className="course-name-cell">
                  {course.fullname}
                </td>

                {isStudent ? (
                  <>
                    <td>
                      {(course.teachers ?? []).length
                        ? course.teachers.map((name) => (
                            <div key={name}>{name}</div>
                          ))
                        : "No teacher assigned"}
                    </td>
                    <td>{course.categoryPath || "—"}</td>
                    <td>{formatDateTime(course.lastAccess)}</td>
                  </>
                ) : (
                  <>
                    <td>
                      {Object.entries(course.activities ?? {}).length
                        ? Object.entries(course.activities).map(
                            ([name, count]) => (
                              <div key={name}>
                                {name}: {count}
                              </div>
                            )
                          )
                        : "No activities or resources"}
                    </td>
                    <td>{formatNumber(course.studentCount)}</td>
                    <td>{formatDateTime(course.lastAccess)}</td>
                  </>
                )}

                <td>
                  <a
                              className="go-to-course-link"
                              href={`/course/view.php?id=${course.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open course →
                            </a>
                </td>
              </tr>
            ))}

            {visibleCourses.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty-state">
                  No courses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="course-pagination">
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-button"
            onClick={() =>
              setCurrentPage((page) => Math.max(1, page - 1))
            }
            disabled={safePage <= 1}
          >
            Previous
          </button>

          <span className="pagination-page-indicator">
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            className="pagination-button"
            onClick={() =>
              setCurrentPage((page) =>
                Math.min(totalPages, page + 1)
              )
            }
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}

function ProfileDetail({ label, value }) {
  return (
    <div className="user-profile-detail">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}
