function getRootElement() {
  const root = document.getElementById("root");

  if (!root) {
    throw new Error("The Moodle dashboard root element was not found.");
  }

  return root;
}

async function request(action, params = {}) {
  const root = getRootElement();
  const endpoint = root.dataset.endpoint;
  const sesskey = root.dataset.sesskey;

  if (!endpoint || !sesskey) {
    throw new Error("The Moodle AJAX endpoint or session key is missing.");
  }

  const url = new URL(endpoint, window.location.origin);

  url.searchParams.set("action", action);
  url.searchParams.set("sesskey", sesskey);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message || `Moodle request failed (${response.status}).`,
    );
  }

  if (!result || result.success !== true) {
    throw new Error(
      result?.message || "LearningPlex returned an invalid response.",
    );
  }

  return result.data ?? result;
}

export function getDashboardOverview() {
  return request("overview");
}

export function getMetricDetails(school, metric) {
  return request("metric_details", { school, metric });
}

export async function getStudentCourses(userId) {
  const result = await request("student_courses", {
    userid: userId,
  });

  return Array.isArray(result?.courses) ? result.courses : [];
}

export async function getTeacherCourses(userId) {
  const result = await request("staff_courses", {
    userid: userId,
  });

  return Array.isArray(result?.courses) ? result.courses : [];
}

// Keep this alias because UniversityStaffPage.jsx already uses it.
export async function getStaffCourses(userId) {
  return getTeacherCourses(userId);
}
