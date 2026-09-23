-- ============================================================================
-- Snowflake Architecture for Fire & Space Wildfire Analytics
-- Database: FIRE_SPACE
-- Schemas: RAW (ingested satellite data), ANALYTICS (modeled analytical marts)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS FIRE_SPACE
    COMMENT = 'Operational telemetry and satellite wildfire data warehouse';

-- RAW Schema for incoming NASA FIRMS telemetry and sensor streams
CREATE SCHEMA IF NOT EXISTS FIRE_SPACE.RAW
    COMMENT = 'Unmodified satellite passes and telemetry streams';

-- ANALYTICS Schema for clustered fires, spread projections, and longitudinal reporting
CREATE SCHEMA IF NOT EXISTS FIRE_SPACE.ANALYTICS
    COMMENT = 'Processed DBSCAN clusters, risk indices, and multi-year fire trends';
