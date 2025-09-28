import { enrollmentApi } from "./api";
import log from "../utils/logger";

export class EnrollmentService {
  private static enrollmentCache: Map<string, number> = new Map();
  private static lastCacheTime: number = 0;
  private static readonly CACHE_DURATION = 30000; // 30 seconds cache

  /**
   * Get enrollment counts for all classes with caching
   */
  static async getClassEnrollmentCounts(
    forceRefresh: boolean = false
  ): Promise<Map<string, number>> {
    const now = Date.now();
    const cacheExpired = now - this.lastCacheTime > this.CACHE_DURATION;

    if (forceRefresh || cacheExpired || this.enrollmentCache.size === 0) {
      try {
        log.info("Fetching fresh enrollment counts");
        this.enrollmentCache = await enrollmentApi.getClassEnrollmentCounts();
        this.lastCacheTime = now;
      } catch (error) {
        log.error("Failed to fetch enrollment counts", { error });
        // Return cached data if available, or empty map
        if (this.enrollmentCache.size === 0) {
          return new Map();
        }
      }
    }

    return new Map(this.enrollmentCache);
  }

  /**
   * Get enrollment count for a specific class
   */
  static async getClassEnrollmentCount(classId: string): Promise<number> {
    try {
      // Try to get from cache first
      const cachedCounts = await this.getClassEnrollmentCounts();
      const cachedCount = cachedCounts.get(classId);

      if (cachedCount !== undefined) {
        return cachedCount;
      }

      // If not in cache, fetch directly
      return await enrollmentApi.getClassEnrollmentCount(classId);
    } catch (error) {
      log.error("Failed to fetch enrollment count for class", {
        classId,
        error,
      });
      return 0;
    }
  }

  /**
   * Clear the enrollment cache
   */
  static clearCache(): void {
    this.enrollmentCache.clear();
    this.lastCacheTime = 0;
  }

  /**
   * Update enrollment count for a specific class in cache
   */
  static updateCachedCount(classId: string, newCount: number): void {
    this.enrollmentCache.set(classId, newCount);
  }

  /**
   * Invalidate cache when enrollments change
   */
  static invalidateCache(): void {
    this.lastCacheTime = 0;
  }
}

export default EnrollmentService;
