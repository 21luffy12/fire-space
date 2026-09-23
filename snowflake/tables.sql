-- ============================================================================
-- Snowflake Tables: RAW and ANALYTICS Schemas
-- ============================================================================

USE DATABASE FIRE_SPACE;

-- 1. RAW.FIRE_OBSERVATIONS: Every satellite thermal anomaly detected
CREATE TABLE IF NOT EXISTS RAW.FIRE_OBSERVATIONS (
    OBSERVATION_ID           VARCHAR(64)       NOT NULL,
    LATITUDE                 FLOAT             NOT NULL,
    LONGITUDE                FLOAT             NOT NULL,
    GEOMETRY                 GEOGRAPHY,
    ACQUISITION_TIME         TIMESTAMP_NTZ     NOT NULL,
    SATELLITE                VARCHAR(32),
    INSTRUMENT               VARCHAR(32),
    CONFIDENCE               VARCHAR(16),
    BRIGHTNESS_TEMPERATURE   FLOAT,
    FRP                      FLOAT,
    SOURCE                   VARCHAR(32)       DEFAULT 'NASA_FIRMS',
    INGESTED_AT              TIMESTAMP_NTZ     DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (OBSERVATION_ID)
);

-- 2. ANALYTICS.FIRE_CLUSTERS: DBSCAN-grouped active fire complexes
CREATE TABLE IF NOT EXISTS ANALYTICS.FIRE_CLUSTERS (
    CLUSTER_ID               VARCHAR(32)       NOT NULL,
    CENTER_LATITUDE          FLOAT             NOT NULL,
    CENTER_LONGITUDE         FLOAT             NOT NULL,
    HOTSPOT_COUNT            INTEGER           NOT NULL,
    AREA_KM2                 FLOAT,
    AVERAGE_FRP              FLOAT,
    MAX_FRP                  FLOAT,
    RISK_LEVEL               VARCHAR(16),
    PERIMETER_GEOJSON        VARIANT,
    REGION                   VARCHAR(64),
    DETECTED_AT              TIMESTAMP_NTZ     NOT NULL,
    LAST_UPDATED_AT          TIMESTAMP_NTZ     DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (CLUSTER_ID)
);

-- 3. ANALYTICS.SPREAD_PREDICTIONS: 6-hour directional projection vectors
CREATE TABLE IF NOT EXISTS ANALYTICS.SPREAD_PREDICTIONS (
    PREDICTION_ID            VARCHAR(64)       NOT NULL,
    CLUSTER_ID               VARCHAR(32)       NOT NULL,
    DIRECTION_DEGREES        FLOAT             NOT NULL,
    WIND_SPEED               FLOAT,
    WIND_DIRECTION           FLOAT,
    ESTIMATED_DISTANCE_KM    FLOAT,
    PREDICTION_HOURS         INTEGER           DEFAULT 6,
    CONFIDENCE               FLOAT,
    PROJECTED_GEOMETRY       VARIANT,
    CREATED_AT               TIMESTAMP_NTZ     DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (PREDICTION_ID),
    FOREIGN KEY (CLUSTER_ID) REFERENCES ANALYTICS.FIRE_CLUSTERS(CLUSTER_ID)
);

-- 4. RAW.WEATHER_OBSERVATIONS: Regional atmospheric conditions
CREATE TABLE IF NOT EXISTS RAW.WEATHER_OBSERVATIONS (
    OBSERVATION_TIME         TIMESTAMP_NTZ     NOT NULL,
    LATITUDE                 FLOAT             NOT NULL,
    LONGITUDE                FLOAT             NOT NULL,
    TEMPERATURE_C            FLOAT,
    HUMIDITY_PCT             FLOAT,
    WIND_SPEED_KMH           FLOAT,
    WIND_DIRECTION_DEG       FLOAT,
    PRECIPITATION_MM         FLOAT,
    PRESSURE_HPA             FLOAT,
    RECORDED_AT              TIMESTAMP_NTZ     DEFAULT CURRENT_TIMESTAMP()
);
