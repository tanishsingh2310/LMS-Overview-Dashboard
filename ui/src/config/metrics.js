
import {
  BookOpen,
  BookCheck,
  Users,
  GraduationCap,
  UserRoundCheck,
  FlaskConical,
} from "lucide-react";

export const schoolMetrics = [
  {
    key: "courses",
    label: "Total Courses",
    icon: BookOpen,
    description: "All courses in this school",
  },
  {
    key: "activeCourses",
    label: "Active Courses",
    icon: BookCheck,
    description: "Courses with at least 5 students and 1 teacher",
  },
  {
    key: "students",
    label: "Students",
    icon: Users,
    description: "Students belonging to this school",
  },
  {
    key: "teachers",
    label: "Faculties",
    icon: GraduationCap,
    description: "Faculties belonging to this school",
  },
];

export const universityMetrics = [
  {
    key: "courses",
    label: "Total Courses",
    icon: BookOpen,
    description: "Courses managed by GSFC University",
  },
  {
    key: "activeCourses",
    label: "Active Courses",
    icon: BookCheck,
    description: "GSFC University courses with at least 5 students and 1 teacher",
  },
  {
    key: "visitingFaculty",
    label: "Visiting Faculty",
    icon: UserRoundCheck,
    description: "Visiting faculty assigned to GSFC University courses",
  },
  {
    key: "labInstructors",
    label: "Lab Instructors",
    icon: FlaskConical,
    description: "Lab instructors assigned to GSFC University courses",
  },
];

export function getMetricsForEntity(entity) {
  return entity.type === "university"
    ? universityMetrics
    : schoolMetrics;
}
