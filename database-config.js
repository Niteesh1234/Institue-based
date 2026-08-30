const serverEnvironment = typeof process !== 'undefined' && process?.env ? process.env : {};

export const VIJETHA_DATABASE_NAME = serverEnvironment.MONGODB_DATABASE || 'coach-exam';
export const VIJETHA_INSTITUTE_ID = 'vijetha';

export const VIJETHA_COLLECTIONS = Object.freeze({
  authUsers: 'auth_users_Vijetha',
  authOtps: 'auth_otps_Vijetha',
  authSessions: 'auth_sessions_Vijetha',
  authAttempts: 'auth_attempts_Vijetha',
  students: 'students_Vijetha',
  batchExams: 'batch_exams_Vijetha',
  examSubmissions: 'exam_submissions_Vijetha',
  resources: 'resources_Vijetha',
  instituteControl: 'institute_control_Vijetha',
  courseCatalog: 'course_catalog_Vijetha',
  resourceFilesBucket: 'resource_files_Vijetha',
});

export function vijethaCourseCollections(courseKey) {
  const key = String(courseKey || 'jnvst').trim().toLowerCase();
  return Object.freeze({
    questions: `${key}_questions_Vijetha`,
    tests: `${key}_tests_Vijetha`,
    syllabus: `${key}_syllabus_topics_Vijetha`,
    validation: `${key}_validation_runs_Vijetha`,
  });
}
