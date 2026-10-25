import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";

import { getMetricDetails, getStaffCourses } from "../api/dashboardApi";
import StatusBadge from "../components/StatusBadge";
import SortableHeader from "../components/SortableHeader";
import { sortRowsBy } from "../utils/sorting";
import { formatDateTime, formatNumber } from "../utils/formatters";

const PAGE_SIZE = 10;

function normalizeStaffType(type) {
  if (type === "labInstructor") return "labInstructors";
  return type;
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export default function UniversityStaffPage({
  staffType,
  entities = [],
  onBack,
}) {
  const normalizedStaffType = normalizeStaffType(staffType);
  const isVisitingFaculty = normalizedStaffType === "visitingFaculty";
  const title = isVisitingFaculty ? "Visiting Faculty" : "Lab Instructors";

  const [staffList, setStaffList] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState("");

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState("");

  const [directorySearch, setDirectorySearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseSearch, setCourseSearch] = useState("");

  const [directoryPage, setDirectoryPage] = useState(1);
  const [coursePage, setCoursePage] = useState(1);

  const [directorySortKey, setDirectorySortKey] = useState("fullname");
  const [directorySortDirection, setDirectorySortDirection] = useState("asc");
  const [courseSortKey, setCourseSortKey] = useState("fullname");
  const [courseSortDirection, setCourseSortDirection] = useState("asc");

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      setLoadingStaff(true);
      setStaffError("");
      setStaffList([]);

      try {
        const schoolList = entities.length
          ? entities.filter((entity) => entity.shortname)
          : [{ shortname: "GSFCU" }];

        const results = await Promise.all(
  schoolList.map(async (entity) => {
    try {
      return await getMetricDetails(
        entity.shortname,
        normalizedStaffType
      );
    } catch (error) {
      console.error(
        `Failed to load ${normalizedStaffType} for ${entity.shortname}:`,
        error
      );

      return { users: [], failed: true, school: entity.shortname };
    }
  })
);

const failedSchools = results
  .filter((result) => result.failed)
  .map((result) => result.school);

if (failedSchools.length === schoolList.length) {
  throw new Error(
    `Unable to load ${title}. Check the browser console for details.`
  );
}

if (failedSchools.length > 0) {
  console.warn("Some school staff records could not be loaded:", failedSchools);
}

        const peopleById = new Map();

        results.forEach((result) => {
          const people = Array.isArray(result?.users) ? result.users : [];

          people.forEach((person) => {
            const key = String(person.id ?? person.username ?? person.fullname);
            if (!peopleById.has(key)) {
              peopleById.set(key, {
                ...person,
                id: person.id ?? key,
                fullname:
                  person.fullname ||
                  person.name ||
                  person.username ||
                  "Unnamed user",
                designation: person.designation || person.idnumber || "",
                department: person.department || "",
                institution: person.institution || "",
                online: Boolean(person.online),
                courseCount: Number(person.courseCount ?? 0),
                lastAccess: person.lastAccess ?? 0,
              });
            }
          });
        });

        if (!cancelled) {
          setStaffList(Array.from(peopleById.values()));
        }
      } catch (error) {
        if (!cancelled) {
          setStaffError(
            getErrorMessage(error, "Unable to load...")
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingStaff(false);
        }
      }
    }

    loadStaff();

    return () => {
      cancelled = true;
    };
  }, [entities, normalizedStaffType]);

  const departmentOptions = useMemo(
    () =>
      [
        ...new Set(
          staffList.map((person) => person.department).filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [staffList]
  );

  const filteredStaff = useMemo(() => {
    const query = directorySearch.trim().toLowerCase();

    return staffList.filter((person) => {
      const searchMatches = [
        person.fullname,
        person.designation,
        person.department,
        person.email,
        person.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);

      const departmentMatches =
        departmentFilter === "all" ||
        person.department === departmentFilter;

      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "online"
          ? Boolean(person.online)
          : !person.online);

      return searchMatches && departmentMatches && statusMatches;
    });
  }, [staffList, directorySearch, departmentFilter, statusFilter]);

  const sortedStaff = useMemo(
    () =>
      sortRowsBy(
        filteredStaff,
        directorySortKey,
        directorySortDirection,
        {
          status: (person) => Boolean(person.online),
          courseCount: (person) => Number(person.courseCount ?? 0),
        }
      ),
    [filteredStaff, directorySortKey, directorySortDirection]
  );

  const directoryTotalPages = Math.max(
    1,
    Math.ceil(sortedStaff.length / PAGE_SIZE)
  );
  const safeDirectoryPage = Math.min(directoryPage, directoryTotalPages);

  const visibleStaff = sortedStaff.slice(
    (safeDirectoryPage - 1) * PAGE_SIZE,
    safeDirectoryPage * PAGE_SIZE
  );

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();

    return assignedCourses.filter((course) =>
      [course.fullname, course.shortname, course.categoryPath]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [assignedCourses, courseSearch]);

  const sortedCourses = useMemo(
    () =>
      sortRowsBy(filteredCourses, courseSortKey, courseSortDirection, {
        courseLink: (course) => course.fullname,
      }),
    [filteredCourses, courseSortKey, courseSortDirection]
  );

  const courseTotalPages = Math.max(
    1,
    Math.ceil(sortedCourses.length / PAGE_SIZE)
  );
  const safeCoursePage = Math.min(coursePage, courseTotalPages);

  const visibleCourses = sortedCourses.slice(
    (safeCoursePage - 1) * PAGE_SIZE,
    safeCoursePage * PAGE_SIZE
  );

  function handleDirectorySort(nextKey) {
    if (directorySortKey === nextKey) {
      setDirectorySortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
    } else {
      setDirectorySortKey(nextKey);
      setDirectorySortDirection("asc");
    }

    setDirectoryPage(1);
  }

  function handleCourseSort(nextKey) {
    if (courseSortKey === nextKey) {
      setCourseSortDirection((current) =>
        current === "asc" ? "desc" : "asc"
      );
    } else {
      setCourseSortKey(nextKey);
      setCourseSortDirection("asc");
    }

    setCoursePage(1);
  }

  function resetDirectoryFilters() {
    setDirectorySearch("");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setDirectorySortKey("fullname");
    setDirectorySortDirection("asc");
    setDirectoryPage(1);
  }

  function resetCourseFilters() {
    setCourseSearch("");
    setCourseSortKey("fullname");
    setCourseSortDirection("asc");
    setCoursePage(1);
  }

  async function openStaffProfile(person) {
    setSelectedStaff(person);
    setAssignedCourses([]);
    setCoursesError("");
    setLoadingCourses(true);
    setCourseSearch("");
    setCoursePage(1);

    try {
      const courses = await getStaffCourses(person.id);
      setAssignedCourses(courses);
    } catch (error) {
      setCoursesError(
        getErrorMessage(error, "Unable to load assigned courses.")
      );
    } finally {
      setLoadingCourses(false);
    }
  }

  function goBack() {
    if (selectedStaff) {
      setSelectedStaff(null);
      setAssignedCourses([]);
      setCoursesError("");
    } else {
      onBack();
    }
  }

  return (
    <main className="metric-details-page">
      <button type="button" className="back-button" onClick={goBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        Back
      </button>

      {selectedStaff ? (
        <>
          <header className="user-profile-panel">
            <div className="user-profile-main">
              <h1 className="user-profile-name">
                {selectedStaff.fullname}
              </h1>
              <p className="user-profile-role">
                {selectedStaff.designation || title}
              </p>
            </div>

            <div className="user-profile-status">
              <StatusBadge online={Boolean(selectedStaff.online)} />
            </div>

            <div className="user-profile-details">
              <ProfileDetail
                label="Department"
                value={selectedStaff.department}
              />
              <ProfileDetail
                label="Branch"
                value={selectedStaff.institution}
              />
              <ProfileDetail
                label="Email ID"
                value={selectedStaff.email}
              />
              <ProfileDetail
                label="Last Access"
                value={formatDateTime(selectedStaff.lastAccess)}
              />
            </div>
          </header>

          <div className="section-heading-row">
            <div>
              <h2 className="metrics-section-title">Assigned Courses</h2>
              <p className="section-description">
                {loadingCourses
                  ? "Loading courses…"
                  : `${formatNumber(filteredCourses.length)} course${
                      filteredCourses.length === 1 ? "" : "s"
                    } found`}
              </p>
            </div>
          </div>

          {coursesError && (
            <div role="alert" className="table-empty-state">
              <p>{coursesError}</p>
              <button
                type="button"
                onClick={() => openStaffProfile(selectedStaff)}
              >
                Retry
              </button>
            </div>
          )}

          {!coursesError && (
            <>
              <section
                className="table-toolbar"
                aria-label="Assigned course filters"
              >
                <label className="table-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    type="search"
                    value={courseSearch}
                    placeholder="Search courses"
                    onChange={(event) => {
                      setCourseSearch(event.target.value);
                      setCoursePage(1);
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="reset-filters-button"
                  onClick={resetCourseFilters}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  Reset filters
                </button>
              </section>

              <div className="table-results-summary">
                {loadingCourses
                  ? "Loading assigned courses…"
                  : `Showing ${
                      filteredCourses.length
                        ? (safeCoursePage - 1) * PAGE_SIZE + 1
                        : 0
                    }–${Math.min(
                      safeCoursePage * PAGE_SIZE,
                      filteredCourses.length
                    )} of ${filteredCourses.length} courses`}
              </div>

              <div className="course-table-wrapper">
                <table className="course-table">
                  <thead>
                    <tr>
                      <SortableHeader
                        label="S.No."
                        sortKey="id"
                        activeSortKey={courseSortKey}
                        direction={courseSortDirection}
                        onSort={handleCourseSort}
                      />
                      <SortableHeader
                        label="Course Full Name"
                        sortKey="fullname"
                        activeSortKey={courseSortKey}
                        direction={courseSortDirection}
                        onSort={handleCourseSort}
                      />
                      <SortableHeader
                        label="Course Category"
                        sortKey="categoryPath"
                        activeSortKey={courseSortKey}
                        direction={courseSortDirection}
                        onSort={handleCourseSort}
                      />
                      <SortableHeader
                        label="No. of Students"
                        sortKey="studentCount"
                        activeSortKey={courseSortKey}
                        direction={courseSortDirection}
                        onSort={handleCourseSort}
                      />
                      <SortableHeader
                        label="Last Access"
                        sortKey="lastAccess"
                        activeSortKey={courseSortKey}
                        direction={courseSortDirection}
                        onSort={handleCourseSort}
                      />
                      <SortableHeader
                        label="Course Link"
                        sortKey="courseLink"
                        activeSortKey={courseSortKey}
                        direction={courseSortDirection}
                        onSort={handleCourseSort}
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {loadingCourses ? (
                      <tr>
                        <td colSpan={6} className="table-empty-state">
                          Loading assigned courses…
                        </td>
                      </tr>
                    ) : (
                      visibleCourses.map((course, index) => (
                        <tr key={course.id}>
                          <td>
                            {(safeCoursePage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="course-name-cell">
                            {course.fullname}
                          </td>
                          <td>{course.categoryPath || "—"}</td>
                          <td>{formatNumber(course.studentCount ?? 0)}</td>
                          <td>{formatDateTime(course.lastAccess)}</td>
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
                      ))
                    )}

                    {!loadingCourses && visibleCourses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="table-empty-state">
                          No assigned courses found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <PaginationSummary
                page={safeCoursePage}
                totalPages={courseTotalPages}
                onPageChange={setCoursePage}
              />
            </>
          )}
        </>
      ) : (
        <>
          <header className="details-heading">
            <div>
              <h1>{title}</h1>
              <p>GSFC University</p>
            </div>
          </header>

          {staffError && (
            <div role="alert" className="table-empty-state">
              <p>{staffError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}

          {!staffError && (
            <>
              <section
                className="table-toolbar"
                aria-label="Staff search and filters"
              >
                <label className="table-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    type="search"
                    value={directorySearch}
                    placeholder="Search staff"
                    onChange={(event) => {
                      setDirectorySearch(event.target.value);
                      setDirectoryPage(1);
                    }}
                  />
                </label>

                <label className="filter-select">
                  <span className="sr-only">Filter by department</span>
                  <select
                    aria-label="Filter by department"
                    value={departmentFilter}
                    onChange={(event) => {
                      setDepartmentFilter(event.target.value);
                      setDirectoryPage(1);
                    }}
                  >
                    <option value="all">All Departments</option>
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="filter-select">
                  <span className="sr-only">Filter by status</span>
                  <select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value);
                      setDirectoryPage(1);
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="reset-filters-button"
                  onClick={resetDirectoryFilters}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  Reset filters
                </button>
              </section>

              <div className="table-results-summary">
                {loadingStaff
                  ? "Loading…"
                  : `Showing ${
                      filteredStaff.length
                        ? (safeDirectoryPage - 1) * PAGE_SIZE + 1
                        : 0
                    }–${Math.min(
                      safeDirectoryPage * PAGE_SIZE,
                      filteredStaff.length
                    )} of ${filteredStaff.length} records`}
              </div>

              <div className="course-table-wrapper">
                <table className="course-table">
                  <thead>
                    <tr>
                      <SortableHeader
                        label="S.No."
                        sortKey="id"
                        activeSortKey={directorySortKey}
                        direction={directorySortDirection}
                        onSort={handleDirectorySort}
                      />
                      <SortableHeader
                        label="Name"
                        sortKey="fullname"
                        activeSortKey={directorySortKey}
                        direction={directorySortDirection}
                        onSort={handleDirectorySort}
                      />
                      <SortableHeader
                        label="Designation"
                        sortKey="designation"
                        activeSortKey={directorySortKey}
                        direction={directorySortDirection}
                        onSort={handleDirectorySort}
                      />
                      <SortableHeader
                        label="Department"
                        sortKey="department"
                        activeSortKey={directorySortKey}
                        direction={directorySortDirection}
                        onSort={handleDirectorySort}
                      />
                      <SortableHeader
                        label="Status"
                        sortKey="status"
                        activeSortKey={directorySortKey}
                        direction={directorySortDirection}
                        onSort={handleDirectorySort}
                      />
                      <SortableHeader
                        label="Courses"
                        sortKey="courseCount"
                        activeSortKey={directorySortKey}
                        direction={directorySortDirection}
                        onSort={handleDirectorySort}
                      />
                      <SortableHeader
                        label="Last Access"
                        sortKey="lastAccess"
                        activeSortKey={directorySortKey}
                        direction={directorySortDirection}
                        onSort={handleDirectorySort}
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {loadingStaff ? (
                      <tr>
                        <td colSpan={7} className="table-empty-state">
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      visibleStaff.map((person, index) => (
                        <tr key={person.id}>
                          <td>
                            {(safeDirectoryPage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="table-name-link"
                              onClick={() => openStaffProfile(person)}
                              aria-label={`View profile and assigned courses for ${person.fullname}`}
                            >
                              {person.fullname}
                            </button>
                          </td>
                          <td>{person.designation || "—"}</td>
                          <td>{person.department || "—"}</td>
                          <td>
                            <StatusBadge online={Boolean(person.online)} />
                          </td>
                          <td>{formatNumber(person.courseCount)}</td>
                          <td>{formatDateTime(person.lastAccess)}</td>
                        </tr>
                      ))
                    )}

                    {!loadingStaff && visibleStaff.length === 0 && (
                      <tr>
                        <td colSpan={7} className="table-empty-state">
                          No record found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <PaginationSummary
                page={safeDirectoryPage}
                totalPages={directoryTotalPages}
                onPageChange={setDirectoryPage}
              />
            </>
          )}
        </>
      )}
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

function PaginationSummary({ page, totalPages, onPageChange }) {
  return (
    <div className="course-pagination">
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-button"
          onClick={() => onPageChange((value) => Math.max(1, value - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="pagination-page-indicator">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="pagination-button"
          onClick={() =>
            onPageChange((value) => Math.min(totalPages, value + 1))
          }
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
