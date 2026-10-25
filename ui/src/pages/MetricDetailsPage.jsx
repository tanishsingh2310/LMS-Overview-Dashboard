import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";

import { getMetricDetails } from "../api/dashboardApi";
import StatusBadge from "../components/StatusBadge";
import SortableHeader from "../components/SortableHeader";
import { sortRowsBy } from "../utils/sorting";
import { formatDateTime, formatNumber } from "../utils/formatters";

const PAGE_SIZE = 10;

export default function MetricDetailsPage({
  entity,
  metric,
  onBack,
  onUserCoursesSelect,
  onUniversityStaffSelect,
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState("fullname");
  const [sortDirection, setSortDirection] = useState("asc");

  const [liveCourses, setLiveCourses] = useState([]);
  const [liveUsers, setLiveUsers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const metricKey = metric?.key ?? "";
  const metricTitle = metric?.label ?? "Overview";

  const isCourseMetric =
    metricKey === "courses" || metricKey === "activeCourses";
  const isActiveCourses = metricKey === "activeCourses";
  const isStudentsMetric = metricKey === "students";
  const isTeachersMetric = metricKey === "teachers";
  const isVisitingFaculty = metricKey === "visitingFaculty";
  const isLabInstructors = metricKey === "labInstructors";
  const isUserMetric = isStudentsMetric || isTeachersMetric;

  useEffect(() => {
    let cancelled = false;

    async function loadMetricDetails() {
      setDataLoading(true);
      setDataError("");
      setLiveCourses([]);
      setLiveUsers([]);

      try {
        const result = await getMetricDetails(
          entity.shortname,
          metricKey
        );

        if (cancelled) return;

        setLiveCourses(
          Array.isArray(result?.courses) ? result.courses : []
        );
        setLiveUsers(
          Array.isArray(result?.users) ? result.users : []
        );
      } catch (error) {
        if (!cancelled) {
          setDataError(
            error?.message || "Unable to load records from Moodle."
          );
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    }

    if (isCourseMetric || isUserMetric) {
      loadMetricDetails();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDataLoading(false);
      setDataError("");
      setLiveCourses([]);
      setLiveUsers([]);
    }

    return () => {
      cancelled = true;
    };
  }, [
    entity.shortname,
    metricKey,
    isCourseMetric,
    isUserMetric,
  ]);

  const entityCourses = useMemo(() => {
    return liveCourses.filter((course) => {
      if (course.visible === false || Number(course.id) === 1) {
        return false;
      }

      if (
        isActiveCourses &&
        (
          Number(course.studentCount ?? 0) < 5 ||
          !(course.teachers ?? []).length
        )
      ) {
        return false;
      }

      return true;
    });
  }, [liveCourses, isActiveCourses]);

  const entityUsers = useMemo(
    () => liveUsers,
    [liveUsers]
  );

  const departmentOptions = useMemo(() => {
    const source = isCourseMetric ? entityCourses : entityUsers;

    return [
      ...new Set(
        source
          .map((item) =>
            isCourseMetric ? item.categoryPath : item.department
          )
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [entityCourses, entityUsers, isCourseMetric]);

  const batchOptions = useMemo(() => {
    if (!isStudentsMetric) return [];

    return [
      ...new Set(
        entityUsers
          .map((student) => student.idnumber)
          .filter((value) => value !== null && value !== undefined && value !== "")
          .map(String)
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [entityUsers, isStudentsMetric]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = isCourseMetric ? entityCourses : entityUsers;

    return source.filter((item) => {
      const searchText = isCourseMetric
        ? [
            item.fullname,
            item.shortname,
            item.categoryPath,
            ...(item.teachers ?? []),
          ]
            .filter(Boolean)
            .join(" ")
        : [
            item.username,
            item.fullname,
            item.department,
            item.idnumber,
            item.institution,
            item.designation,
          ]
            .filter(Boolean)
            .join(" ");

      if (query && !searchText.toLowerCase().includes(query)) {
        return false;
      }

      const departmentValue = isCourseMetric
        ? item.categoryPath
        : item.department;

      if (
        department !== "all" &&
        departmentValue !== department
      ) {
        return false;
      }

      if (
        isStudentsMetric &&
        batchFilter !== "all" &&
        String(item.idnumber ?? "") !== batchFilter
      ) {
        return false;
      }

      if (
        isCourseMetric &&
        teacherFilter === "assigned" &&
        !(item.teachers ?? []).length
      ) {
        return false;
      }

      if (
        isCourseMetric &&
        teacherFilter === "unassigned" &&
        (item.teachers ?? []).length > 0
      ) {
        return false;
      }

      if (isUserMetric && statusFilter === "online" && !item.online) {
        return false;
      }

      if (isUserMetric && statusFilter === "offline" && item.online) {
        return false;
      }

      return true;
    });
  }, [
    search,
    department,
    batchFilter,
    teacherFilter,
    statusFilter,
    isCourseMetric,
    isUserMetric,
    isStudentsMetric,
    entityCourses,
    entityUsers,
  ]);

  const sortedRows = useMemo(
    () =>
      sortRowsBy(filteredRows, sortKey, sortDirection, {
        teachersCount: (row) => (row.teachers ?? []).length,
        courseCount: (row) => Number(row.courseCount ?? 0),
        status: (row) => Boolean(row.online),
        designation: (row) => row.designation ?? row.idnumber,
        enrollment: (row) => row.username,
        batch: (row) => row.idnumber,
        courseLink: (row) => row.fullname,
      }),
    [filteredRows, sortKey, sortDirection]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRows.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const visibleRows = sortedRows.slice(
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

  function updateFilter(setter, value) {
    setter(value);
    setCurrentPage(1);
  }

  function resetFilters() {
    setSearch("");
    setDepartment("all");
    setBatchFilter("all");
    setTeacherFilter("all");
    setStatusFilter("all");
    setSortKey("fullname");
    setSortDirection("asc");
    setCurrentPage(1);
  }

  function countUserCourses(user) {
    return Number(user.courseCount ?? 0);
  }

  const showRecordsTable = isCourseMetric || isUserMetric;

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

      <header className="details-heading">
        <h1>{metricTitle}</h1>
        <p>{entity.name || entity.shortname}</p>
      </header>

      {showRecordsTable ? (
        <>
          {dataLoading ? (
            <p role="status">Loading...</p>
          ) : dataError ? (
            <section className="staff-entry-panel" role="alert">
              <p>{dataError}</p>
              <button
                type="button"
                className="primary-link-button"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </section>
          ) : (
            <>
              <section
                className="table-toolbar"
                aria-label="Table filters"
              >
                <label className="table-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    placeholder="Search"
                    onChange={(event) =>
                      updateFilter(setSearch, event.target.value)
                    }
                  />
                </label>

                <label className="filter-select">
                  <span className="sr-only">
                    {isCourseMetric
                      ? "Filter by category"
                      : "Filter by department"}
                  </span>

                  <select
                    value={department}
                    onChange={(event) =>
                      updateFilter(setDepartment, event.target.value)
                    }
                  >
                    <option value="all">
                      {isCourseMetric
                        ? "All categories"
                        : "All departments"}
                    </option>

                    {departmentOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                {isStudentsMetric && (
                  <label className="filter-select">
                    <span className="sr-only">
                      Filter students by batch
                    </span>

                    <select
                      value={batchFilter}
                      onChange={(event) =>
                        updateFilter(setBatchFilter, event.target.value)
                      }
                    >
                      <option value="all">All batches</option>

                      {batchOptions.map((batch) => (
                        <option key={batch} value={batch}>
                          {batch}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {isCourseMetric ? (
                  <label className="filter-select">
                    <span className="sr-only">
                      Filter by teacher assignment
                    </span>

                    <select
                      value={teacherFilter}
                      onChange={(event) =>
                        updateFilter(setTeacherFilter, event.target.value)
                      }
                    >
                      <option value="all">All courses</option>
                      <option value="assigned">Has teacher</option>
                      <option value="unassigned">
                        No teacher assigned
                      </option>
                    </select>
                  </label>
                ) : (
                  <label className="filter-select">
                    <span className="sr-only">
                      Filter by status
                    </span>

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        updateFilter(setStatusFilter, event.target.value)
                      }
                    >
                      <option value="all">All statuses</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </label>
                )}

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
                {filteredRows.length
                  ? (safePage - 1) * PAGE_SIZE + 1
                  : 0}
                –{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of{" "}
                {filteredRows.length} records
              </div>

              <div className="course-table-wrapper">
                <table className="course-table">
                  <thead>
                    {isCourseMetric ? (
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
                          label="No. of Teachers"
                          sortKey="teachersCount"
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
                          label="Course Category"
                          sortKey="categoryPath"
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
                    ) : isStudentsMetric ? (
                      <tr>
                        <SortableHeader
                          label="Enrollment No."
                          sortKey="enrollment"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Name"
                          sortKey="fullname"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Department"
                          sortKey="department"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Batch"
                          sortKey="batch"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Courses Enrolled"
                          sortKey="courseCount"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Status"
                          sortKey="status"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Last Access"
                          sortKey="lastAccess"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                      </tr>
                    ) : (
                      <tr>
                        <SortableHeader
                          label="Name"
                          sortKey="fullname"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Designation"
                          sortKey="designation"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Department"
                          sortKey="department"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Courses Teaching"
                          sortKey="courseCount"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Status"
                          sortKey="status"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Last Access"
                          sortKey="lastAccess"
                          activeSortKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {visibleRows.map((item, index) => {
                      if (isCourseMetric) {
                        return (
                          <tr key={item.id}>
                            <td>
                              {(safePage - 1) * PAGE_SIZE + index + 1}
                            </td>
                            <td className="course-name-cell">
                              {item.fullname}
                            </td>
                            <td>{(item.teachers ?? []).length}</td>
                            <td>{formatNumber(item.studentCount)}</td>
                            <td>{item.categoryPath || "—"}</td>
                            <td>
                              
<a
  className="go-to-course-link"
  href={`/course/view.php?id=${encodeURIComponent(item.id)}`}
  target="_blank"
  rel="noopener noreferrer"
>
  Open course →
</a>

                            </td>
                          </tr>
                        );
                      }

                      const count = countUserCourses(item);
                      const userType = isStudentsMetric
                        ? "student"
                        : "teacher";

                      return (
                        <tr key={item.id}>
                          {isStudentsMetric && (
                            <td>{item.username || "—"}</td>
                          )}

                          <td>
                            <button
                              type="button"
                              className="table-name-link"
                              onClick={() =>
                                onUserCoursesSelect?.(item, userType)
                              }
                              aria-label={`View profile and courses for ${item.fullname}`}
                            >
                              {item.fullname}
                            </button>
                          </td>

                          {!isStudentsMetric && (
                            <td>
                              {item.designation || item.idnumber || "—"}
                            </td>
                          )}

                          <td>{item.department || "—"}</td>

                          {isStudentsMetric && (
                            <td>{item.idnumber || "—"}</td>
                          )}

                          <td>{formatNumber(count)}</td>
                          <td>
                            <StatusBadge online={Boolean(item.online)} />
                          </td>
                          <td>{formatDateTime(item.lastAccess)}</td>
                        </tr>
                      );
                    })}

                    {visibleRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={
                            isCourseMetric
                              ? 6
                              : isStudentsMetric
                                ? 7
                                : 6
                          }
                          className="table-empty-state"
                        >
                          No matching records found.
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

                  <span>
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
            </>
          )}
        </>
      ) : isVisitingFaculty || isLabInstructors ? (
        <section className="staff-entry-panel">
          <p>
            Open the university staff page to search, view profile details,
            check status, and inspect assigned courses.
          </p>

          <button
            type="button"
            className="primary-link-button"
            onClick={() =>
              onUniversityStaffSelect?.(
                isVisitingFaculty ? "visitingFaculty" : "labInstructor"
              )
            }
          >
            View{" "}
            {isVisitingFaculty ? "Visiting Faculty" : "Lab Instructors"} →
          </button>
        </section>
      ) : (
        <section className="staff-entry-panel">
          <p>
            Detailed records for {metricTitle} have not been connected yet.
            These will be populated from Moodle when backend integration is
            implemented.
          </p>
        </section>
      )}
    </main>
  );
}