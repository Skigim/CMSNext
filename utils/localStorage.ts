// This file has been removed as it violates the antipattern guidelines.
// The platform should only use:
// 1. Supabase API (when isApiEnabled() = true)
// 2. File Storage API (when isApiEnabled() = false)
//
// localStorage should not be used as a storage method according to the architecture.
// 
// See Guidelines.md for the correct API selection pattern:
// const dataAPI = isApiEnabled() ? caseApi : fileDataProvider.getAPI();

export const DEPRECATED_FILE_MARKER = 'This file has been deprecated to prevent localStorage contamination';