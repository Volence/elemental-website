time="2025-12-27T03:33:39-05:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2025-12-27T03:33:39-05:00" level=warning msg="/home/volence/elmt/elemental-website/docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
--
-- PostgreSQL database dump
--

\restrict FdclvnItJrYoaI9iFSQtQoEXSOr4RsQ1DtthJUzKWbdNjOFugR3NRRAxtDKPlSY

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: enum__pages_v_blocks_content_columns_link_appearance; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_blocks_content_columns_link_appearance AS ENUM (
    'default',
    'outline'
);


ALTER TYPE public.enum__pages_v_blocks_content_columns_link_appearance OWNER TO payload;

--
-- Name: enum__pages_v_blocks_content_columns_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_blocks_content_columns_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum__pages_v_blocks_content_columns_link_type OWNER TO payload;

--
-- Name: enum__pages_v_blocks_content_columns_size; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_blocks_content_columns_size AS ENUM (
    'oneThird',
    'half',
    'twoThirds',
    'full'
);


ALTER TYPE public.enum__pages_v_blocks_content_columns_size OWNER TO payload;

--
-- Name: enum__pages_v_blocks_cta_links_link_appearance; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_blocks_cta_links_link_appearance AS ENUM (
    'default',
    'outline'
);


ALTER TYPE public.enum__pages_v_blocks_cta_links_link_appearance OWNER TO payload;

--
-- Name: enum__pages_v_blocks_cta_links_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_blocks_cta_links_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum__pages_v_blocks_cta_links_link_type OWNER TO payload;

--
-- Name: enum__pages_v_version_hero_links_link_appearance; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_version_hero_links_link_appearance AS ENUM (
    'default',
    'outline'
);


ALTER TYPE public.enum__pages_v_version_hero_links_link_appearance OWNER TO payload;

--
-- Name: enum__pages_v_version_hero_links_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_version_hero_links_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum__pages_v_version_hero_links_link_type OWNER TO payload;

--
-- Name: enum__pages_v_version_hero_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_version_hero_type AS ENUM (
    'none',
    'highImpact',
    'mediumImpact',
    'lowImpact'
);


ALTER TYPE public.enum__pages_v_version_hero_type OWNER TO payload;

--
-- Name: enum__pages_v_version_status; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum__pages_v_version_status AS ENUM (
    'draft',
    'published'
);


ALTER TYPE public.enum__pages_v_version_status OWNER TO payload;

--
-- Name: enum_footer_nav_items_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_footer_nav_items_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum_footer_nav_items_link_type OWNER TO payload;

--
-- Name: enum_header_nav_items_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_header_nav_items_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum_header_nav_items_link_type OWNER TO payload;

--
-- Name: enum_invite_links_role; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_invite_links_role AS ENUM (
    'admin',
    'team-manager',
    'staff-manager',
    'user'
);


ALTER TYPE public.enum_invite_links_role OWNER TO payload;

--
-- Name: enum_matches_league; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_matches_league AS ENUM (
    'Masters',
    'Expert',
    'Advanced',
    'Open'
);


ALTER TYPE public.enum_matches_league OWNER TO payload;

--
-- Name: enum_matches_region; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_matches_region AS ENUM (
    'NA',
    'EMEA',
    'SA'
);


ALTER TYPE public.enum_matches_region OWNER TO payload;

--
-- Name: enum_matches_status; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_matches_status AS ENUM (
    'scheduled',
    'cancelled'
);


ALTER TYPE public.enum_matches_status OWNER TO payload;

--
-- Name: enum_organization_staff_roles; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_organization_staff_roles AS ENUM (
    'owner',
    'co-owner',
    'hr',
    'moderator',
    'event-manager',
    'social-manager',
    'graphics',
    'media-editor'
);


ALTER TYPE public.enum_organization_staff_roles OWNER TO payload;

--
-- Name: enum_pages_blocks_content_columns_link_appearance; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_blocks_content_columns_link_appearance AS ENUM (
    'default',
    'outline'
);


ALTER TYPE public.enum_pages_blocks_content_columns_link_appearance OWNER TO payload;

--
-- Name: enum_pages_blocks_content_columns_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_blocks_content_columns_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum_pages_blocks_content_columns_link_type OWNER TO payload;

--
-- Name: enum_pages_blocks_content_columns_size; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_blocks_content_columns_size AS ENUM (
    'oneThird',
    'half',
    'twoThirds',
    'full'
);


ALTER TYPE public.enum_pages_blocks_content_columns_size OWNER TO payload;

--
-- Name: enum_pages_blocks_cta_links_link_appearance; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_blocks_cta_links_link_appearance AS ENUM (
    'default',
    'outline'
);


ALTER TYPE public.enum_pages_blocks_cta_links_link_appearance OWNER TO payload;

--
-- Name: enum_pages_blocks_cta_links_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_blocks_cta_links_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum_pages_blocks_cta_links_link_type OWNER TO payload;

--
-- Name: enum_pages_hero_links_link_appearance; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_hero_links_link_appearance AS ENUM (
    'default',
    'outline'
);


ALTER TYPE public.enum_pages_hero_links_link_appearance OWNER TO payload;

--
-- Name: enum_pages_hero_links_link_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_hero_links_link_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum_pages_hero_links_link_type OWNER TO payload;

--
-- Name: enum_pages_hero_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_hero_type AS ENUM (
    'none',
    'highImpact',
    'mediumImpact',
    'lowImpact'
);


ALTER TYPE public.enum_pages_hero_type OWNER TO payload;

--
-- Name: enum_pages_status; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_pages_status AS ENUM (
    'draft',
    'published'
);


ALTER TYPE public.enum_pages_status OWNER TO payload;

--
-- Name: enum_payload_jobs_log_state; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_payload_jobs_log_state AS ENUM (
    'failed',
    'succeeded'
);


ALTER TYPE public.enum_payload_jobs_log_state OWNER TO payload;

--
-- Name: enum_payload_jobs_log_task_slug; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_payload_jobs_log_task_slug AS ENUM (
    'inline',
    'schedulePublish'
);


ALTER TYPE public.enum_payload_jobs_log_task_slug OWNER TO payload;

--
-- Name: enum_payload_jobs_task_slug; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_payload_jobs_task_slug AS ENUM (
    'inline',
    'schedulePublish'
);


ALTER TYPE public.enum_payload_jobs_task_slug OWNER TO payload;

--
-- Name: enum_production_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_production_type AS ENUM (
    'caster',
    'observer',
    'producer',
    'observer-producer',
    'observer-producer-caster'
);


ALTER TYPE public.enum_production_type OWNER TO payload;

--
-- Name: enum_recruitment_applications_status; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_recruitment_applications_status AS ENUM (
    'new',
    'reviewing',
    'contacted',
    'tryout',
    'accepted',
    'rejected'
);


ALTER TYPE public.enum_recruitment_applications_status OWNER TO payload;

--
-- Name: enum_recruitment_listings_category; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_recruitment_listings_category AS ENUM (
    'player',
    'team-staff',
    'org-staff'
);


ALTER TYPE public.enum_recruitment_listings_category OWNER TO payload;

--
-- Name: enum_recruitment_listings_role; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_recruitment_listings_role AS ENUM (
    'tank',
    'dps',
    'support',
    'coach',
    'manager',
    'assistant-coach',
    'moderator',
    'event-manager',
    'social-manager',
    'graphics',
    'media-editor',
    'caster',
    'observer',
    'producer',
    'observer-producer'
);


ALTER TYPE public.enum_recruitment_listings_role OWNER TO payload;

--
-- Name: enum_recruitment_listings_status; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_recruitment_listings_status AS ENUM (
    'open',
    'filled',
    'closed'
);


ALTER TYPE public.enum_recruitment_listings_status OWNER TO payload;

--
-- Name: enum_redirects_to_type; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_redirects_to_type AS ENUM (
    'reference',
    'custom'
);


ALTER TYPE public.enum_redirects_to_type OWNER TO payload;

--
-- Name: enum_teams_region; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_teams_region AS ENUM (
    'NA',
    'EMEA',
    'SA',
    'Other'
);


ALTER TYPE public.enum_teams_region OWNER TO payload;

--
-- Name: enum_teams_roster_role; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_teams_roster_role AS ENUM (
    'tank',
    'dps',
    'support'
);


ALTER TYPE public.enum_teams_roster_role OWNER TO payload;

--
-- Name: enum_users_role; Type: TYPE; Schema: public; Owner: payload
--

CREATE TYPE public.enum_users_role AS ENUM (
    'admin',
    'team-manager',
    'staff-manager',
    'user'
);


ALTER TYPE public.enum_users_role OWNER TO payload;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _pages_v; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v (
    id integer NOT NULL,
    parent_id integer,
    version_title character varying,
    version_hero_type public.enum__pages_v_version_hero_type DEFAULT 'lowImpact'::public.enum__pages_v_version_hero_type,
    version_hero_rich_text jsonb,
    version_hero_media_id integer,
    version_meta_title character varying,
    version_meta_image_id integer,
    version_meta_description character varying,
    version_published_at timestamp(3) with time zone,
    version_generate_slug boolean DEFAULT true,
    version_slug character varying,
    version_updated_at timestamp(3) with time zone,
    version_created_at timestamp(3) with time zone,
    version__status public.enum__pages_v_version_status DEFAULT 'draft'::public.enum__pages_v_version_status,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    latest boolean,
    autosave boolean
);


ALTER TABLE public._pages_v OWNER TO payload;

--
-- Name: _pages_v_blocks_content; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v_blocks_content (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    _path text NOT NULL,
    id integer NOT NULL,
    _uuid character varying,
    block_name character varying
);


ALTER TABLE public._pages_v_blocks_content OWNER TO payload;

--
-- Name: _pages_v_blocks_content_columns; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v_blocks_content_columns (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id integer NOT NULL,
    size public.enum__pages_v_blocks_content_columns_size DEFAULT 'oneThird'::public.enum__pages_v_blocks_content_columns_size,
    rich_text jsonb,
    enable_link boolean,
    link_type public.enum__pages_v_blocks_content_columns_link_type DEFAULT 'reference'::public.enum__pages_v_blocks_content_columns_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying,
    link_appearance public.enum__pages_v_blocks_content_columns_link_appearance DEFAULT 'default'::public.enum__pages_v_blocks_content_columns_link_appearance,
    _uuid character varying
);


ALTER TABLE public._pages_v_blocks_content_columns OWNER TO payload;

--
-- Name: _pages_v_blocks_content_columns_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_blocks_content_columns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_blocks_content_columns_id_seq OWNER TO payload;

--
-- Name: _pages_v_blocks_content_columns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_blocks_content_columns_id_seq OWNED BY public._pages_v_blocks_content_columns.id;


--
-- Name: _pages_v_blocks_content_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_blocks_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_blocks_content_id_seq OWNER TO payload;

--
-- Name: _pages_v_blocks_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_blocks_content_id_seq OWNED BY public._pages_v_blocks_content.id;


--
-- Name: _pages_v_blocks_cta; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v_blocks_cta (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    _path text NOT NULL,
    id integer NOT NULL,
    rich_text jsonb,
    _uuid character varying,
    block_name character varying
);


ALTER TABLE public._pages_v_blocks_cta OWNER TO payload;

--
-- Name: _pages_v_blocks_cta_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_blocks_cta_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_blocks_cta_id_seq OWNER TO payload;

--
-- Name: _pages_v_blocks_cta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_blocks_cta_id_seq OWNED BY public._pages_v_blocks_cta.id;


--
-- Name: _pages_v_blocks_cta_links; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v_blocks_cta_links (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id integer NOT NULL,
    link_type public.enum__pages_v_blocks_cta_links_link_type DEFAULT 'reference'::public.enum__pages_v_blocks_cta_links_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying,
    link_appearance public.enum__pages_v_blocks_cta_links_link_appearance DEFAULT 'default'::public.enum__pages_v_blocks_cta_links_link_appearance,
    _uuid character varying
);


ALTER TABLE public._pages_v_blocks_cta_links OWNER TO payload;

--
-- Name: _pages_v_blocks_cta_links_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_blocks_cta_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_blocks_cta_links_id_seq OWNER TO payload;

--
-- Name: _pages_v_blocks_cta_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_blocks_cta_links_id_seq OWNED BY public._pages_v_blocks_cta_links.id;


--
-- Name: _pages_v_blocks_media_block; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v_blocks_media_block (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    _path text NOT NULL,
    id integer NOT NULL,
    media_id integer,
    _uuid character varying,
    block_name character varying
);


ALTER TABLE public._pages_v_blocks_media_block OWNER TO payload;

--
-- Name: _pages_v_blocks_media_block_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_blocks_media_block_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_blocks_media_block_id_seq OWNER TO payload;

--
-- Name: _pages_v_blocks_media_block_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_blocks_media_block_id_seq OWNED BY public._pages_v_blocks_media_block.id;


--
-- Name: _pages_v_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_id_seq OWNER TO payload;

--
-- Name: _pages_v_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_id_seq OWNED BY public._pages_v.id;


--
-- Name: _pages_v_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    pages_id integer
);


ALTER TABLE public._pages_v_rels OWNER TO payload;

--
-- Name: _pages_v_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_rels_id_seq OWNER TO payload;

--
-- Name: _pages_v_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_rels_id_seq OWNED BY public._pages_v_rels.id;


--
-- Name: _pages_v_version_hero_links; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public._pages_v_version_hero_links (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id integer NOT NULL,
    link_type public.enum__pages_v_version_hero_links_link_type DEFAULT 'reference'::public.enum__pages_v_version_hero_links_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying,
    link_appearance public.enum__pages_v_version_hero_links_link_appearance DEFAULT 'default'::public.enum__pages_v_version_hero_links_link_appearance,
    _uuid character varying
);


ALTER TABLE public._pages_v_version_hero_links OWNER TO payload;

--
-- Name: _pages_v_version_hero_links_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public._pages_v_version_hero_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._pages_v_version_hero_links_id_seq OWNER TO payload;

--
-- Name: _pages_v_version_hero_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public._pages_v_version_hero_links_id_seq OWNED BY public._pages_v_version_hero_links.id;


--
-- Name: assigned_c; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.assigned_c (
    _order integer DEFAULT 1 NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    user_id integer,
    style character varying
);


ALTER TABLE public.assigned_c OWNER TO payload;

--
-- Name: assigned_c_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.assigned_c_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assigned_c_id_seq OWNER TO payload;

--
-- Name: assigned_c_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.assigned_c_id_seq OWNED BY public.assigned_c.id;


--
-- Name: caster_su; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.caster_su (
    _order integer DEFAULT 1 NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    user_id integer,
    style character varying
);


ALTER TABLE public.caster_su OWNER TO payload;

--
-- Name: caster_su_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.caster_su_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.caster_su_id_seq OWNER TO payload;

--
-- Name: caster_su_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.caster_su_id_seq OWNED BY public.caster_su.id;


--
-- Name: data_consistency; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.data_consistency (
    id integer NOT NULL,
    updated_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone
);


ALTER TABLE public.data_consistency OWNER TO payload;

--
-- Name: data_consistency_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.data_consistency_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.data_consistency_id_seq OWNER TO payload;

--
-- Name: data_consistency_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.data_consistency_id_seq OWNED BY public.data_consistency.id;


--
-- Name: footer; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.footer (
    id integer NOT NULL,
    updated_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone
);


ALTER TABLE public.footer OWNER TO payload;

--
-- Name: footer_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.footer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.footer_id_seq OWNER TO payload;

--
-- Name: footer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.footer_id_seq OWNED BY public.footer.id;


--
-- Name: footer_nav_items; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.footer_nav_items (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    link_type public.enum_footer_nav_items_link_type DEFAULT 'reference'::public.enum_footer_nav_items_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying NOT NULL
);


ALTER TABLE public.footer_nav_items OWNER TO payload;

--
-- Name: footer_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.footer_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    pages_id integer
);


ALTER TABLE public.footer_rels OWNER TO payload;

--
-- Name: footer_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.footer_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.footer_rels_id_seq OWNER TO payload;

--
-- Name: footer_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.footer_rels_id_seq OWNED BY public.footer_rels.id;


--
-- Name: header; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.header (
    id integer NOT NULL,
    updated_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone
);


ALTER TABLE public.header OWNER TO payload;

--
-- Name: header_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.header_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.header_id_seq OWNER TO payload;

--
-- Name: header_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.header_id_seq OWNED BY public.header.id;


--
-- Name: header_nav_items; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.header_nav_items (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    link_type public.enum_header_nav_items_link_type DEFAULT 'reference'::public.enum_header_nav_items_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying NOT NULL
);


ALTER TABLE public.header_nav_items OWNER TO payload;

--
-- Name: header_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.header_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    pages_id integer
);


ALTER TABLE public.header_rels OWNER TO payload;

--
-- Name: header_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.header_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.header_rels_id_seq OWNER TO payload;

--
-- Name: header_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.header_rels_id_seq OWNED BY public.header_rels.id;


--
-- Name: ignored_duplicates; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.ignored_duplicates (
    id integer NOT NULL,
    person1_id integer NOT NULL,
    person2_id integer NOT NULL,
    label character varying NOT NULL,
    reason character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ignored_duplicates OWNER TO payload;

--
-- Name: ignored_duplicates_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.ignored_duplicates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ignored_duplicates_id_seq OWNER TO payload;

--
-- Name: ignored_duplicates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.ignored_duplicates_id_seq OWNED BY public.ignored_duplicates.id;


--
-- Name: invite_links; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.invite_links (
    id integer NOT NULL,
    token character varying NOT NULL,
    role public.enum_invite_links_role NOT NULL,
    email character varying,
    expires_at timestamp(3) with time zone NOT NULL,
    used_at timestamp(3) with time zone,
    used_by_id integer,
    created_by_id integer,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    departments_is_production_staff boolean DEFAULT false,
    departments_is_social_media_staff boolean DEFAULT false
);


ALTER TABLE public.invite_links OWNER TO payload;

--
-- Name: invite_links_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.invite_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invite_links_id_seq OWNER TO payload;

--
-- Name: invite_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.invite_links_id_seq OWNED BY public.invite_links.id;


--
-- Name: invite_links_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.invite_links_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    teams_id integer
);


ALTER TABLE public.invite_links_rels OWNER TO payload;

--
-- Name: invite_links_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.invite_links_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invite_links_rels_id_seq OWNER TO payload;

--
-- Name: invite_links_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.invite_links_rels_id_seq OWNED BY public.invite_links_rels.id;


--
-- Name: matches; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.matches (
    id integer NOT NULL,
    team_id integer,
    opponent character varying,
    date timestamp(3) with time zone NOT NULL,
    region public.enum_matches_region NOT NULL,
    league public.enum_matches_league NOT NULL,
    season character varying,
    status public.enum_matches_status DEFAULT 'scheduled'::public.enum_matches_status NOT NULL,
    title character varying,
    title_cell character varying,
    score_elmt_score numeric,
    score_opponent_score numeric,
    stream_url character varying,
    stream_streamed_by character varying,
    faceit_lobby character varying,
    vod character varying,
    generate_slug boolean DEFAULT true,
    slug character varying NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    match_type character varying DEFAULT 'team-match'::character varying,
    production_workflow_priority character varying DEFAULT 'none'::character varying,
    production_workflow_week_generated timestamp with time zone,
    production_workflow_is_archived boolean DEFAULT false,
    production_workflow_assigned_observer_id integer,
    production_workflow_assigned_producer_id integer,
    production_workflow_coverage_status character varying,
    production_workflow_include_in_schedule boolean DEFAULT false,
    production_workflow_production_notes jsonb
);


ALTER TABLE public.matches OWNER TO payload;

--
-- Name: matches_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.matches_id_seq OWNER TO payload;

--
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- Name: matches_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.matches_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    users_id integer
);


ALTER TABLE public.matches_rels OWNER TO payload;

--
-- Name: matches_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.matches_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.matches_rels_id_seq OWNER TO payload;

--
-- Name: matches_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.matches_rels_id_seq OWNED BY public.matches_rels.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.media (
    id integer NOT NULL,
    alt character varying,
    caption jsonb,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    url character varying,
    thumbnail_u_r_l character varying,
    filename character varying,
    mime_type character varying,
    filesize numeric,
    width numeric,
    height numeric,
    focal_x numeric,
    focal_y numeric,
    sizes_thumbnail_url character varying,
    sizes_thumbnail_width numeric,
    sizes_thumbnail_height numeric,
    sizes_thumbnail_mime_type character varying,
    sizes_thumbnail_filesize numeric,
    sizes_thumbnail_filename character varying,
    sizes_square_url character varying,
    sizes_square_width numeric,
    sizes_square_height numeric,
    sizes_square_mime_type character varying,
    sizes_square_filesize numeric,
    sizes_square_filename character varying,
    sizes_small_url character varying,
    sizes_small_width numeric,
    sizes_small_height numeric,
    sizes_small_mime_type character varying,
    sizes_small_filesize numeric,
    sizes_small_filename character varying,
    sizes_medium_url character varying,
    sizes_medium_width numeric,
    sizes_medium_height numeric,
    sizes_medium_mime_type character varying,
    sizes_medium_filesize numeric,
    sizes_medium_filename character varying,
    sizes_large_url character varying,
    sizes_large_width numeric,
    sizes_large_height numeric,
    sizes_large_mime_type character varying,
    sizes_large_filesize numeric,
    sizes_large_filename character varying,
    sizes_xlarge_url character varying,
    sizes_xlarge_width numeric,
    sizes_xlarge_height numeric,
    sizes_xlarge_mime_type character varying,
    sizes_xlarge_filesize numeric,
    sizes_xlarge_filename character varying,
    sizes_og_url character varying,
    sizes_og_width numeric,
    sizes_og_height numeric,
    sizes_og_mime_type character varying,
    sizes_og_filesize numeric,
    sizes_og_filename character varying
);


ALTER TABLE public.media OWNER TO payload;

--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.media_id_seq OWNER TO payload;

--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: organization_staff; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.organization_staff (
    id integer NOT NULL,
    person_id integer NOT NULL,
    display_name character varying DEFAULT '[Untitled]'::character varying,
    slug character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.organization_staff OWNER TO payload;

--
-- Name: organization_staff_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.organization_staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organization_staff_id_seq OWNER TO payload;

--
-- Name: organization_staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.organization_staff_id_seq OWNED BY public.organization_staff.id;


--
-- Name: organization_staff_roles; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.organization_staff_roles (
    "order" integer NOT NULL,
    parent_id integer NOT NULL,
    value public.enum_organization_staff_roles,
    id integer NOT NULL
);


ALTER TABLE public.organization_staff_roles OWNER TO payload;

--
-- Name: organization_staff_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.organization_staff_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organization_staff_roles_id_seq OWNER TO payload;

--
-- Name: organization_staff_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.organization_staff_roles_id_seq OWNED BY public.organization_staff_roles.id;


--
-- Name: pages; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages (
    id integer NOT NULL,
    title character varying,
    hero_type public.enum_pages_hero_type DEFAULT 'lowImpact'::public.enum_pages_hero_type,
    hero_rich_text jsonb,
    hero_media_id integer,
    meta_title character varying,
    meta_image_id integer,
    meta_description character varying,
    published_at timestamp(3) with time zone,
    generate_slug boolean DEFAULT true,
    slug character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    _status public.enum_pages_status DEFAULT 'draft'::public.enum_pages_status
);


ALTER TABLE public.pages OWNER TO payload;

--
-- Name: pages_blocks_content; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages_blocks_content (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    _path text NOT NULL,
    id character varying NOT NULL,
    block_name character varying
);


ALTER TABLE public.pages_blocks_content OWNER TO payload;

--
-- Name: pages_blocks_content_columns; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages_blocks_content_columns (
    _order integer NOT NULL,
    _parent_id character varying NOT NULL,
    id character varying NOT NULL,
    size public.enum_pages_blocks_content_columns_size DEFAULT 'oneThird'::public.enum_pages_blocks_content_columns_size,
    rich_text jsonb,
    enable_link boolean,
    link_type public.enum_pages_blocks_content_columns_link_type DEFAULT 'reference'::public.enum_pages_blocks_content_columns_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying,
    link_appearance public.enum_pages_blocks_content_columns_link_appearance DEFAULT 'default'::public.enum_pages_blocks_content_columns_link_appearance
);


ALTER TABLE public.pages_blocks_content_columns OWNER TO payload;

--
-- Name: pages_blocks_cta; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages_blocks_cta (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    _path text NOT NULL,
    id character varying NOT NULL,
    rich_text jsonb,
    block_name character varying
);


ALTER TABLE public.pages_blocks_cta OWNER TO payload;

--
-- Name: pages_blocks_cta_links; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages_blocks_cta_links (
    _order integer NOT NULL,
    _parent_id character varying NOT NULL,
    id character varying NOT NULL,
    link_type public.enum_pages_blocks_cta_links_link_type DEFAULT 'reference'::public.enum_pages_blocks_cta_links_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying,
    link_appearance public.enum_pages_blocks_cta_links_link_appearance DEFAULT 'default'::public.enum_pages_blocks_cta_links_link_appearance
);


ALTER TABLE public.pages_blocks_cta_links OWNER TO payload;

--
-- Name: pages_blocks_media_block; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages_blocks_media_block (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    _path text NOT NULL,
    id character varying NOT NULL,
    media_id integer,
    block_name character varying
);


ALTER TABLE public.pages_blocks_media_block OWNER TO payload;

--
-- Name: pages_hero_links; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages_hero_links (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    link_type public.enum_pages_hero_links_link_type DEFAULT 'reference'::public.enum_pages_hero_links_link_type,
    link_new_tab boolean,
    link_url character varying,
    link_label character varying,
    link_appearance public.enum_pages_hero_links_link_appearance DEFAULT 'default'::public.enum_pages_hero_links_link_appearance
);


ALTER TABLE public.pages_hero_links OWNER TO payload;

--
-- Name: pages_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pages_id_seq OWNER TO payload;

--
-- Name: pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.pages_id_seq OWNED BY public.pages.id;


--
-- Name: pages_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.pages_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    pages_id integer
);


ALTER TABLE public.pages_rels OWNER TO payload;

--
-- Name: pages_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.pages_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pages_rels_id_seq OWNER TO payload;

--
-- Name: pages_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.pages_rels_id_seq OWNED BY public.pages_rels.id;


--
-- Name: payload_jobs; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_jobs (
    id integer NOT NULL,
    input jsonb,
    completed_at timestamp(3) with time zone,
    total_tried numeric DEFAULT 0,
    has_error boolean DEFAULT false,
    error jsonb,
    task_slug public.enum_payload_jobs_task_slug,
    queue character varying DEFAULT 'default'::character varying,
    wait_until timestamp(3) with time zone,
    processing boolean DEFAULT false,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payload_jobs OWNER TO payload;

--
-- Name: payload_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.payload_jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_jobs_id_seq OWNER TO payload;

--
-- Name: payload_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.payload_jobs_id_seq OWNED BY public.payload_jobs.id;


--
-- Name: payload_jobs_log; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_jobs_log (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    executed_at timestamp(3) with time zone NOT NULL,
    completed_at timestamp(3) with time zone NOT NULL,
    task_slug public.enum_payload_jobs_log_task_slug NOT NULL,
    task_i_d character varying NOT NULL,
    input jsonb,
    output jsonb,
    state public.enum_payload_jobs_log_state NOT NULL,
    error jsonb
);


ALTER TABLE public.payload_jobs_log OWNER TO payload;

--
-- Name: payload_kv; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_kv (
    id integer NOT NULL,
    key character varying NOT NULL,
    data jsonb NOT NULL
);


ALTER TABLE public.payload_kv OWNER TO payload;

--
-- Name: payload_kv_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.payload_kv_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_kv_id_seq OWNER TO payload;

--
-- Name: payload_kv_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.payload_kv_id_seq OWNED BY public.payload_kv.id;


--
-- Name: payload_locked_documents; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_locked_documents (
    id integer NOT NULL,
    global_slug character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payload_locked_documents OWNER TO payload;

--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.payload_locked_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_locked_documents_id_seq OWNER TO payload;

--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.payload_locked_documents_id_seq OWNED BY public.payload_locked_documents.id;


--
-- Name: payload_locked_documents_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_locked_documents_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    pages_id integer,
    media_id integer,
    people_id integer,
    teams_id integer,
    matches_id integer,
    production_id integer,
    organization_staff_id integer,
    users_id integer,
    redirects_id integer,
    ignored_duplicates_id integer,
    recruitment_listings_id integer,
    recruitment_applications_id integer,
    invite_links_id integer,
    tournament_templates_id integer,
    refinement_id integer,
    social_posts_id integer
);


ALTER TABLE public.payload_locked_documents_rels OWNER TO payload;

--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.payload_locked_documents_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_locked_documents_rels_id_seq OWNER TO payload;

--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.payload_locked_documents_rels_id_seq OWNED BY public.payload_locked_documents_rels.id;


--
-- Name: payload_migrations; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_migrations (
    id integer NOT NULL,
    name character varying,
    batch numeric,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payload_migrations OWNER TO payload;

--
-- Name: payload_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.payload_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_migrations_id_seq OWNER TO payload;

--
-- Name: payload_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.payload_migrations_id_seq OWNED BY public.payload_migrations.id;


--
-- Name: payload_preferences; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_preferences (
    id integer NOT NULL,
    key character varying,
    value jsonb,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payload_preferences OWNER TO payload;

--
-- Name: payload_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.payload_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_preferences_id_seq OWNER TO payload;

--
-- Name: payload_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.payload_preferences_id_seq OWNED BY public.payload_preferences.id;


--
-- Name: payload_preferences_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.payload_preferences_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    users_id integer
);


ALTER TABLE public.payload_preferences_rels OWNER TO payload;

--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.payload_preferences_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payload_preferences_rels_id_seq OWNER TO payload;

--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.payload_preferences_rels_id_seq OWNED BY public.payload_preferences_rels.id;


--
-- Name: people; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.people (
    id integer NOT NULL,
    name character varying NOT NULL,
    slug character varying,
    bio character varying,
    photo_id integer,
    social_links_twitter character varying,
    social_links_twitch character varying,
    social_links_youtube character varying,
    social_links_instagram character varying,
    social_links_tiktok character varying,
    notes character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.people OWNER TO payload;

--
-- Name: people_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.people_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.people_id_seq OWNER TO payload;

--
-- Name: people_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.people_id_seq OWNED BY public.people.id;


--
-- Name: people_social_links_custom_links; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.people_social_links_custom_links (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    label character varying NOT NULL,
    url character varying NOT NULL
);


ALTER TABLE public.people_social_links_custom_links OWNER TO payload;

--
-- Name: production; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.production (
    id integer NOT NULL,
    person_id integer NOT NULL,
    display_name character varying DEFAULT '[Untitled]'::character varying,
    slug character varying,
    type public.enum_production_type NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production OWNER TO payload;

--
-- Name: production_dashboard; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.production_dashboard (
    id integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.production_dashboard OWNER TO payload;

--
-- Name: production_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.production_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.production_id_seq OWNER TO payload;

--
-- Name: production_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.production_id_seq OWNED BY public.production.id;


--
-- Name: recruitment_applications; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.recruitment_applications (
    id integer NOT NULL,
    listing_id integer NOT NULL,
    discord_handle character varying NOT NULL,
    about_me character varying NOT NULL,
    status public.enum_recruitment_applications_status DEFAULT 'new'::public.enum_recruitment_applications_status NOT NULL,
    internal_notes character varying,
    archived boolean DEFAULT false,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recruitment_applications OWNER TO payload;

--
-- Name: recruitment_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.recruitment_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recruitment_applications_id_seq OWNER TO payload;

--
-- Name: recruitment_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.recruitment_applications_id_seq OWNED BY public.recruitment_applications.id;


--
-- Name: recruitment_listings; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.recruitment_listings (
    id integer NOT NULL,
    category public.enum_recruitment_listings_category DEFAULT 'player'::public.enum_recruitment_listings_category NOT NULL,
    team_id integer,
    role public.enum_recruitment_listings_role NOT NULL,
    requirements character varying NOT NULL,
    status public.enum_recruitment_listings_status DEFAULT 'open'::public.enum_recruitment_listings_status NOT NULL,
    filled_by_id integer,
    created_by_id integer,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recruitment_listings OWNER TO payload;

--
-- Name: recruitment_listings_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.recruitment_listings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recruitment_listings_id_seq OWNER TO payload;

--
-- Name: recruitment_listings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.recruitment_listings_id_seq OWNED BY public.recruitment_listings.id;


--
-- Name: redirects; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.redirects (
    id integer NOT NULL,
    "from" character varying NOT NULL,
    to_type public.enum_redirects_to_type DEFAULT 'reference'::public.enum_redirects_to_type,
    to_url character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.redirects OWNER TO payload;

--
-- Name: redirects_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.redirects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.redirects_id_seq OWNER TO payload;

--
-- Name: redirects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.redirects_id_seq OWNED BY public.redirects.id;


--
-- Name: redirects_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.redirects_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    pages_id integer
);


ALTER TABLE public.redirects_rels OWNER TO payload;

--
-- Name: redirects_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.redirects_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.redirects_rels_id_seq OWNER TO payload;

--
-- Name: redirects_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.redirects_rels_id_seq OWNED BY public.redirects_rels.id;


--
-- Name: rules; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.rules (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    region character varying,
    division character varying,
    matches_per_week integer
);


ALTER TABLE public.rules OWNER TO payload;

--
-- Name: schedule_generator; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.schedule_generator (
    id integer NOT NULL,
    updated_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone
);


ALTER TABLE public.schedule_generator OWNER TO payload;

--
-- Name: schedule_generator_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.schedule_generator_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schedule_generator_id_seq OWNER TO payload;

--
-- Name: schedule_generator_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.schedule_generator_id_seq OWNED BY public.schedule_generator.id;


--
-- Name: slots; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.slots (
    _order integer NOT NULL,
    _parent_id character varying NOT NULL,
    id character varying NOT NULL,
    day_of_week character varying,
    "time" character varying,
    timezone character varying
);


ALTER TABLE public.slots OWNER TO payload;

--
-- Name: social_media_config; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.social_media_config (
    id integer NOT NULL,
    weekly_goals_total_posts_per_week integer DEFAULT 10,
    weekly_goals_match_promos integer DEFAULT 3,
    weekly_goals_stream_announcements integer DEFAULT 2,
    weekly_goals_community_engagement integer DEFAULT 3,
    weekly_goals_original_content integer DEFAULT 2,
    content_guidelines text,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.social_media_config OWNER TO payload;

--
-- Name: social_media_config_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.social_media_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_media_config_id_seq OWNER TO payload;

--
-- Name: social_media_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.social_media_config_id_seq OWNED BY public.social_media_config.id;


--
-- Name: social_media_config_post_templates; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.social_media_config_post_templates (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    name character varying(255) NOT NULL,
    post_type character varying(255) NOT NULL,
    template_text text NOT NULL,
    suggested_media text
);


ALTER TABLE public.social_media_config_post_templates OWNER TO payload;

--
-- Name: social_media_settings; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.social_media_settings (
    id integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    weekly_goals_total_posts_per_week integer DEFAULT 10,
    weekly_goals_match_promos integer DEFAULT 0,
    weekly_goals_stream_announcements integer DEFAULT 0,
    weekly_goals_community_engagement integer DEFAULT 0,
    weekly_goals_original_content integer DEFAULT 0,
    content_guidelines text
);


ALTER TABLE public.social_media_settings OWNER TO payload;

--
-- Name: social_media_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.social_media_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_media_settings_id_seq OWNER TO payload;

--
-- Name: social_media_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.social_media_settings_id_seq OWNED BY public.social_media_settings.id;


--
-- Name: social_media_settings_post_templates; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.social_media_settings_post_templates (
    id integer NOT NULL,
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    name character varying(255) NOT NULL,
    post_type character varying(255) NOT NULL,
    template_text text NOT NULL,
    suggested_media text
);


ALTER TABLE public.social_media_settings_post_templates OWNER TO payload;

--
-- Name: social_media_settings_post_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.social_media_settings_post_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_media_settings_post_templates_id_seq OWNER TO payload;

--
-- Name: social_media_settings_post_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.social_media_settings_post_templates_id_seq OWNED BY public.social_media_settings_post_templates.id;


--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.social_posts (
    id integer NOT NULL,
    content text,
    post_type character varying(255) DEFAULT 'Original Content'::character varying NOT NULL,
    platform character varying(255) DEFAULT 'Twitter/X'::character varying NOT NULL,
    scheduled_date timestamp with time zone,
    status character varying(255) DEFAULT 'Draft'::character varying NOT NULL,
    assigned_to_id integer,
    approved_by_id integer,
    related_match_id integer,
    notes text,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    title character varying(255)
);


ALTER TABLE public.social_posts OWNER TO payload;

--
-- Name: social_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.social_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_posts_id_seq OWNER TO payload;

--
-- Name: social_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.social_posts_id_seq OWNED BY public.social_posts.id;


--
-- Name: social_posts_media_attachments; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.social_posts_media_attachments (
    id integer NOT NULL,
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    media_id integer,
    alt_text character varying(255),
    url text
);


ALTER TABLE public.social_posts_media_attachments OWNER TO payload;

--
-- Name: social_posts_media_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.social_posts_media_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_posts_media_attachments_id_seq OWNER TO payload;

--
-- Name: social_posts_media_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.social_posts_media_attachments_id_seq OWNED BY public.social_posts_media_attachments.id;


--
-- Name: social_posts_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.social_posts_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer,
    path character varying(255) NOT NULL,
    media_id integer
);


ALTER TABLE public.social_posts_rels OWNER TO payload;

--
-- Name: social_posts_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.social_posts_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.social_posts_rels_id_seq OWNER TO payload;

--
-- Name: social_posts_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.social_posts_rels_id_seq OWNED BY public.social_posts_rels.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams (
    id integer NOT NULL,
    name character varying NOT NULL,
    logo character varying NOT NULL,
    region public.enum_teams_region,
    rating character varying,
    theme_color character varying,
    bio character varying,
    active boolean DEFAULT true,
    co_captain_id integer,
    slug character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.teams OWNER TO payload;

--
-- Name: teams_achievements; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams_achievements (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    achievement character varying NOT NULL
);


ALTER TABLE public.teams_achievements OWNER TO payload;

--
-- Name: teams_captain; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams_captain (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    person_id integer NOT NULL
);


ALTER TABLE public.teams_captain OWNER TO payload;

--
-- Name: teams_coaches; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams_coaches (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    person_id integer NOT NULL
);


ALTER TABLE public.teams_coaches OWNER TO payload;

--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_id_seq OWNER TO payload;

--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: teams_manager; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams_manager (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    person_id integer NOT NULL
);


ALTER TABLE public.teams_manager OWNER TO payload;

--
-- Name: teams_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    tournament_templates_id integer
);


ALTER TABLE public.teams_rels OWNER TO payload;

--
-- Name: teams_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.teams_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teams_rels_id_seq OWNER TO payload;

--
-- Name: teams_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.teams_rels_id_seq OWNED BY public.teams_rels.id;


--
-- Name: teams_roster; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams_roster (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    person_id integer NOT NULL,
    role public.enum_teams_roster_role NOT NULL
);


ALTER TABLE public.teams_roster OWNER TO payload;

--
-- Name: teams_subs; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.teams_subs (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    person_id integer NOT NULL
);


ALTER TABLE public.teams_subs OWNER TO payload;

--
-- Name: tournament_templates; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.tournament_templates (
    id integer NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true,
    updated_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tournament_templates OWNER TO payload;

--
-- Name: tournament_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.tournament_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_templates_id_seq OWNER TO payload;

--
-- Name: tournament_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.tournament_templates_id_seq OWNED BY public.tournament_templates.id;


--
-- Name: tournament_templates_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.tournament_templates_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    teams_id integer
);


ALTER TABLE public.tournament_templates_rels OWNER TO payload;

--
-- Name: tournament_templates_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.tournament_templates_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tournament_templates_rels_id_seq OWNER TO payload;

--
-- Name: tournament_templates_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.tournament_templates_rels_id_seq OWNED BY public.tournament_templates_rels.id;


--
-- Name: tournament_templates_rules; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.tournament_templates_rules (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    reg character varying,
    div character varying,
    matches_per_week numeric
);


ALTER TABLE public.tournament_templates_rules OWNER TO payload;

--
-- Name: tournament_templates_rules_slots; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.tournament_templates_rules_slots (
    _order integer NOT NULL,
    _parent_id character varying NOT NULL,
    id character varying NOT NULL,
    day character varying,
    "time" text,
    tz character varying
);


ALTER TABLE public.tournament_templates_rules_slots OWNER TO payload;

--
-- Name: user_profile; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.user_profile (
    id integer NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_profile OWNER TO payload;

--
-- Name: user_profile_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.user_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_profile_id_seq OWNER TO payload;

--
-- Name: user_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.user_profile_id_seq OWNED BY public.user_profile.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying NOT NULL,
    role public.enum_users_role DEFAULT 'team-manager'::public.enum_users_role NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    email character varying NOT NULL,
    reset_password_token character varying,
    reset_password_expiration timestamp(3) with time zone,
    salt character varying,
    hash character varying,
    login_attempts numeric DEFAULT 0,
    lock_until timestamp(3) with time zone,
    avatar_id integer,
    departments_is_production_staff boolean DEFAULT false,
    departments_is_social_media_staff boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO payload;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO payload;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: users_rels; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.users_rels (
    id integer NOT NULL,
    "order" integer,
    parent_id integer NOT NULL,
    path character varying NOT NULL,
    teams_id integer
);


ALTER TABLE public.users_rels OWNER TO payload;

--
-- Name: users_rels_id_seq; Type: SEQUENCE; Schema: public; Owner: payload
--

CREATE SEQUENCE public.users_rels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_rels_id_seq OWNER TO payload;

--
-- Name: users_rels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: payload
--

ALTER SEQUENCE public.users_rels_id_seq OWNED BY public.users_rels.id;


--
-- Name: users_sessions; Type: TABLE; Schema: public; Owner: payload
--

CREATE TABLE public.users_sessions (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id character varying NOT NULL,
    created_at timestamp(3) with time zone,
    expires_at timestamp(3) with time zone NOT NULL
);


ALTER TABLE public.users_sessions OWNER TO payload;

--
-- Name: _pages_v id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v ALTER COLUMN id SET DEFAULT nextval('public._pages_v_id_seq'::regclass);


--
-- Name: _pages_v_blocks_content id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_content ALTER COLUMN id SET DEFAULT nextval('public._pages_v_blocks_content_id_seq'::regclass);


--
-- Name: _pages_v_blocks_content_columns id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_content_columns ALTER COLUMN id SET DEFAULT nextval('public._pages_v_blocks_content_columns_id_seq'::regclass);


--
-- Name: _pages_v_blocks_cta id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_cta ALTER COLUMN id SET DEFAULT nextval('public._pages_v_blocks_cta_id_seq'::regclass);


--
-- Name: _pages_v_blocks_cta_links id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_cta_links ALTER COLUMN id SET DEFAULT nextval('public._pages_v_blocks_cta_links_id_seq'::regclass);


--
-- Name: _pages_v_blocks_media_block id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_media_block ALTER COLUMN id SET DEFAULT nextval('public._pages_v_blocks_media_block_id_seq'::regclass);


--
-- Name: _pages_v_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_rels ALTER COLUMN id SET DEFAULT nextval('public._pages_v_rels_id_seq'::regclass);


--
-- Name: _pages_v_version_hero_links id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_version_hero_links ALTER COLUMN id SET DEFAULT nextval('public._pages_v_version_hero_links_id_seq'::regclass);


--
-- Name: assigned_c id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.assigned_c ALTER COLUMN id SET DEFAULT nextval('public.assigned_c_id_seq'::regclass);


--
-- Name: caster_su id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.caster_su ALTER COLUMN id SET DEFAULT nextval('public.caster_su_id_seq'::regclass);


--
-- Name: data_consistency id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.data_consistency ALTER COLUMN id SET DEFAULT nextval('public.data_consistency_id_seq'::regclass);


--
-- Name: footer id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer ALTER COLUMN id SET DEFAULT nextval('public.footer_id_seq'::regclass);


--
-- Name: footer_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer_rels ALTER COLUMN id SET DEFAULT nextval('public.footer_rels_id_seq'::regclass);


--
-- Name: header id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header ALTER COLUMN id SET DEFAULT nextval('public.header_id_seq'::regclass);


--
-- Name: header_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header_rels ALTER COLUMN id SET DEFAULT nextval('public.header_rels_id_seq'::regclass);


--
-- Name: ignored_duplicates id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.ignored_duplicates ALTER COLUMN id SET DEFAULT nextval('public.ignored_duplicates_id_seq'::regclass);


--
-- Name: invite_links id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links ALTER COLUMN id SET DEFAULT nextval('public.invite_links_id_seq'::regclass);


--
-- Name: invite_links_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links_rels ALTER COLUMN id SET DEFAULT nextval('public.invite_links_rels_id_seq'::regclass);


--
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- Name: matches_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.matches_rels ALTER COLUMN id SET DEFAULT nextval('public.matches_rels_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: organization_staff id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.organization_staff ALTER COLUMN id SET DEFAULT nextval('public.organization_staff_id_seq'::regclass);


--
-- Name: organization_staff_roles id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.organization_staff_roles ALTER COLUMN id SET DEFAULT nextval('public.organization_staff_roles_id_seq'::regclass);


--
-- Name: pages id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages ALTER COLUMN id SET DEFAULT nextval('public.pages_id_seq'::regclass);


--
-- Name: pages_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_rels ALTER COLUMN id SET DEFAULT nextval('public.pages_rels_id_seq'::regclass);


--
-- Name: payload_jobs id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_jobs ALTER COLUMN id SET DEFAULT nextval('public.payload_jobs_id_seq'::regclass);


--
-- Name: payload_kv id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_kv ALTER COLUMN id SET DEFAULT nextval('public.payload_kv_id_seq'::regclass);


--
-- Name: payload_locked_documents id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_id_seq'::regclass);


--
-- Name: payload_locked_documents_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_rels_id_seq'::regclass);


--
-- Name: payload_migrations id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_migrations ALTER COLUMN id SET DEFAULT nextval('public.payload_migrations_id_seq'::regclass);


--
-- Name: payload_preferences id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_preferences ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_id_seq'::regclass);


--
-- Name: payload_preferences_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_preferences_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_rels_id_seq'::regclass);


--
-- Name: people id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.people ALTER COLUMN id SET DEFAULT nextval('public.people_id_seq'::regclass);


--
-- Name: production id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.production ALTER COLUMN id SET DEFAULT nextval('public.production_id_seq'::regclass);


--
-- Name: recruitment_applications id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_applications ALTER COLUMN id SET DEFAULT nextval('public.recruitment_applications_id_seq'::regclass);


--
-- Name: recruitment_listings id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_listings ALTER COLUMN id SET DEFAULT nextval('public.recruitment_listings_id_seq'::regclass);


--
-- Name: redirects id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.redirects ALTER COLUMN id SET DEFAULT nextval('public.redirects_id_seq'::regclass);


--
-- Name: redirects_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.redirects_rels ALTER COLUMN id SET DEFAULT nextval('public.redirects_rels_id_seq'::regclass);


--
-- Name: schedule_generator id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.schedule_generator ALTER COLUMN id SET DEFAULT nextval('public.schedule_generator_id_seq'::regclass);


--
-- Name: social_media_config id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_config ALTER COLUMN id SET DEFAULT nextval('public.social_media_config_id_seq'::regclass);


--
-- Name: social_media_settings id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_settings ALTER COLUMN id SET DEFAULT nextval('public.social_media_settings_id_seq'::regclass);


--
-- Name: social_media_settings_post_templates id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_settings_post_templates ALTER COLUMN id SET DEFAULT nextval('public.social_media_settings_post_templates_id_seq'::regclass);


--
-- Name: social_posts id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts ALTER COLUMN id SET DEFAULT nextval('public.social_posts_id_seq'::regclass);


--
-- Name: social_posts_media_attachments id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_media_attachments ALTER COLUMN id SET DEFAULT nextval('public.social_posts_media_attachments_id_seq'::regclass);


--
-- Name: social_posts_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_rels ALTER COLUMN id SET DEFAULT nextval('public.social_posts_rels_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: teams_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_rels ALTER COLUMN id SET DEFAULT nextval('public.teams_rels_id_seq'::regclass);


--
-- Name: tournament_templates id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates ALTER COLUMN id SET DEFAULT nextval('public.tournament_templates_id_seq'::regclass);


--
-- Name: tournament_templates_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rels ALTER COLUMN id SET DEFAULT nextval('public.tournament_templates_rels_id_seq'::regclass);


--
-- Name: user_profile id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.user_profile ALTER COLUMN id SET DEFAULT nextval('public.user_profile_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: users_rels id; Type: DEFAULT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users_rels ALTER COLUMN id SET DEFAULT nextval('public.users_rels_id_seq'::regclass);


--
-- Data for Name: _pages_v; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v (id, parent_id, version_title, version_hero_type, version_hero_rich_text, version_hero_media_id, version_meta_title, version_meta_image_id, version_meta_description, version_published_at, version_generate_slug, version_slug, version_updated_at, version_created_at, version__status, created_at, updated_at, latest, autosave) FROM stdin;
\.


--
-- Data for Name: _pages_v_blocks_content; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v_blocks_content (_order, _parent_id, _path, id, _uuid, block_name) FROM stdin;
\.


--
-- Data for Name: _pages_v_blocks_content_columns; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v_blocks_content_columns (_order, _parent_id, id, size, rich_text, enable_link, link_type, link_new_tab, link_url, link_label, link_appearance, _uuid) FROM stdin;
\.


--
-- Data for Name: _pages_v_blocks_cta; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v_blocks_cta (_order, _parent_id, _path, id, rich_text, _uuid, block_name) FROM stdin;
\.


--
-- Data for Name: _pages_v_blocks_cta_links; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v_blocks_cta_links (_order, _parent_id, id, link_type, link_new_tab, link_url, link_label, link_appearance, _uuid) FROM stdin;
\.


--
-- Data for Name: _pages_v_blocks_media_block; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v_blocks_media_block (_order, _parent_id, _path, id, media_id, _uuid, block_name) FROM stdin;
\.


--
-- Data for Name: _pages_v_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v_rels (id, "order", parent_id, path, pages_id) FROM stdin;
\.


--
-- Data for Name: _pages_v_version_hero_links; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public._pages_v_version_hero_links (_order, _parent_id, id, link_type, link_new_tab, link_url, link_label, link_appearance, _uuid) FROM stdin;
\.


--
-- Data for Name: assigned_c; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.assigned_c (_order, _parent_id, id, user_id, style) FROM stdin;
1	7	694cbc30406a7400439ab39e	3	play-by-play
2	7	694cc02d406a7400439ab39f	1	color
\.


--
-- Data for Name: caster_su; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.caster_su (_order, _parent_id, id, user_id, style) FROM stdin;
1	7	694cb4bc948ec75595138f7b	3	play-by-play
2	7	694cb4e7948ec75595138f7d	1	color
1	40	694f458a497394004367f1d5	5	\N
1	38	694f458a497394004367f1d0	5	\N
1	36	694f458a497394004367f1d3	5	\N
1	34	694f458a497394004367f1d4	5	\N
1	32	694f458a497394004367f1d1	5	\N
1	30	694f458a497394004367f1d2	5	\N
1	28	694f458b497394004367f1d6	5	\N
1	26	694f458b497394004367f1d7	5	\N
\.


--
-- Data for Name: data_consistency; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.data_consistency (id, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: footer; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.footer (id, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: footer_nav_items; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.footer_nav_items (_order, _parent_id, id, link_type, link_new_tab, link_url, link_label) FROM stdin;
\.


--
-- Data for Name: footer_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.footer_rels (id, "order", parent_id, path, pages_id) FROM stdin;
\.


--
-- Data for Name: header; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.header (id, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: header_nav_items; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.header_nav_items (_order, _parent_id, id, link_type, link_new_tab, link_url, link_label) FROM stdin;
\.


--
-- Data for Name: header_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.header_rels (id, "order", parent_id, path, pages_id) FROM stdin;
\.


--
-- Data for Name: ignored_duplicates; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.ignored_duplicates (id, person1_id, person2_id, label, reason, updated_at, created_at) FROM stdin;
1	160	94	storm ≠ Stormy	\N	2025-12-22 15:39:34.306+00	2025-12-22 15:39:34.305+00
2	47	23	Hemisphere ≠ Hemizphere	\N	2025-12-22 15:39:47.658+00	2025-12-22 15:39:47.658+00
3	133	68	COOKIE ≠ Mookie	\N	2025-12-22 15:40:02.17+00	2025-12-22 15:40:02.17+00
\.


--
-- Data for Name: invite_links; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.invite_links (id, token, role, email, expires_at, used_at, used_by_id, created_by_id, updated_at, created_at, departments_is_production_staff, departments_is_social_media_staff) FROM stdin;
2	f09909fa-574f-4203-aa3e-908e4d1df3bb	user	\N	2026-01-02 01:32:16.149+00	2025-12-26 01:34:40.255+00	5	1	2025-12-26 01:34:40.269+00	2025-12-26 01:32:16.163+00	t	f
\.


--
-- Data for Name: invite_links_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.invite_links_rels (id, "order", parent_id, path, teams_id) FROM stdin;
\.


--
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.matches (id, team_id, opponent, date, region, league, season, status, title, title_cell, score_elmt_score, score_opponent_score, stream_url, stream_streamed_by, faceit_lobby, vod, generate_slug, slug, updated_at, created_at, match_type, production_workflow_priority, production_workflow_week_generated, production_workflow_is_archived, production_workflow_assigned_observer_id, production_workflow_assigned_producer_id, production_workflow_coverage_status, production_workflow_include_in_schedule, production_workflow_production_notes) FROM stdin;
24	32		2025-12-31 23:00:00+00	SA	Masters	FACEIT Season 7	scheduled	ELMT Heaven vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491300-a0fb51h	2025-12-26 02:51:31.36+00	2025-12-26 02:51:31.359+00	team-match	none	2025-12-26 02:51:31.288+00	f	\N	\N	none	f	\N
25	32		2026-01-02 23:00:00+00	SA	Masters	FACEIT Season 7	scheduled	ELMT Heaven vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491528-owx858u	2025-12-26 02:51:31.548+00	2025-12-26 02:51:31.547+00	team-match	none	2025-12-26 02:51:31.526+00	f	\N	\N	none	f	\N
27	31		2026-01-01 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Steel vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491703-e7vekxm	2025-12-26 02:51:31.718+00	2025-12-26 02:51:31.718+00	team-match	none	2025-12-26 02:51:31.701+00	f	\N	\N	none	f	\N
29	29		2026-01-01 02:00:00+00	NA	Expert	FACEIT Season 7	scheduled	ELMT Normal vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491818-htmxszd	2025-12-26 02:51:31.836+00	2025-12-26 02:51:31.836+00	team-match	none	2025-12-26 02:51:31.817+00	f	\N	\N	none	f	\N
31	28		2026-01-01 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Reality vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491953-uukugl1	2025-12-26 02:51:31.976+00	2025-12-26 02:51:31.976+00	team-match	none	2025-12-26 02:51:31.951+00	f	\N	\N	none	f	\N
33	27		2026-01-01 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Fighting vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492088-7nehcw0	2025-12-26 02:51:32.135+00	2025-12-26 02:51:32.135+00	team-match	none	2025-12-26 02:51:32.085+00	f	\N	\N	none	f	\N
35	26		2026-01-01 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Shade vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492260-0vdqale	2025-12-26 02:51:32.277+00	2025-12-26 02:51:32.277+00	team-match	none	2025-12-26 02:51:32.259+00	f	\N	\N	none	f	\N
37	25		2026-01-01 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Poison vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492380-i12gwiz	2025-12-26 02:51:32.399+00	2025-12-26 02:51:32.399+00	team-match	none	2025-12-26 02:51:32.378+00	f	\N	\N	none	f	\N
39	24		2026-01-01 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Water vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492501-v0o7fy7	2025-12-26 02:51:32.52+00	2025-12-26 02:51:32.519+00	team-match	none	2025-12-26 02:51:32.5+00	f	\N	\N	none	f	\N
41	23		2026-01-01 02:00:00+00	NA	Advanced	FACEIT Season 7	scheduled	ELMT Dragon vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492632-t28mgho	2025-12-26 02:51:32.657+00	2025-12-26 02:51:32.656+00	team-match	none	2025-12-26 02:51:32.629+00	f	\N	\N	none	f	\N
42	22		2026-01-01 02:00:00+00	NA	Masters	FACEIT Season 7	scheduled	ELMT Garden vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492685-hzj5bto	2025-12-26 02:51:32.696+00	2025-12-26 02:51:32.696+00	team-match	none	2025-12-26 02:51:32.685+00	f	\N	\N	none	f	\N
43	22		2026-01-03 02:00:00+00	NA	Masters	FACEIT Season 7	scheduled	ELMT Garden vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492722-9n4esh0	2025-12-26 02:51:32.733+00	2025-12-26 02:51:32.733+00	team-match	none	2025-12-26 02:51:32.721+00	f	\N	\N	none	f	\N
40	23		2025-12-30 02:00:00+00	NA	Advanced	FACEIT Season 7	scheduled	ELMT Dragon vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492557-mn45o8d	2025-12-27 03:06:30.548+00	2025-12-26 02:51:32.575+00	team-match	medium	2025-12-26 02:51:32.556+00	f	\N	\N	none	f	\N
38	24		2025-12-30 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Water vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492440-j401b8d	2025-12-27 03:06:30.564+00	2025-12-26 02:51:32.458+00	team-match	none	2025-12-26 02:51:32.439+00	f	\N	\N	none	f	\N
36	25		2025-12-30 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Poison vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492316-772e3r5	2025-12-27 03:06:30.824+00	2025-12-26 02:51:32.331+00	team-match	none	2025-12-26 02:51:32.315+00	f	\N	\N	none	f	\N
34	26		2025-12-30 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Shade vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492207-6gcpndi	2025-12-27 03:06:31.045+00	2025-12-26 02:51:32.221+00	team-match	none	2025-12-26 02:51:32.204+00	f	\N	\N	none	f	\N
32	27		2025-12-30 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Fighting vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717492016-2timsxr	2025-12-27 03:06:31.177+00	2025-12-26 02:51:32.032+00	team-match	none	2025-12-26 02:51:32.015+00	f	\N	\N	none	f	\N
30	28		2025-12-30 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Reality vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491882-vf0j311	2025-12-27 03:06:31.236+00	2025-12-26 02:51:31.91+00	team-match	none	2025-12-26 02:51:31.88+00	f	\N	\N	none	f	\N
28	29		2025-12-30 02:00:00+00	NA	Expert	FACEIT Season 7	scheduled	ELMT Normal vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491755-m2qkot0	2025-12-27 03:06:31.278+00	2025-12-26 02:51:31.771+00	team-match	none	2025-12-26 02:51:31.754+00	f	\N	\N	none	f	\N
26	31		2025-12-30 02:00:00+00	NA	Open	FACEIT Season 7	scheduled	ELMT Steel vs TBD	\N	\N	\N	\N	\N		\N	t	match-1766717491630-0otzhlj	2025-12-27 03:06:31.371+00	2025-12-26 02:51:31.655+00	team-match	none	2025-12-26 02:51:31.624+00	f	\N	\N	none	f	\N
\.


--
-- Data for Name: matches_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.matches_rels (id, "order", parent_id, path, users_id) FROM stdin;
36	1	4	productionWorkflow.observerSignups	2
37	1	4	productionWorkflow.producerSignups	2
38	1	7	productionWorkflow.observerSignups	2
39	2	7	productionWorkflow.observerSignups	3
40	1	7	productionWorkflow.producerSignups	2
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.media (id, alt, caption, updated_at, created_at, url, thumbnail_u_r_l, filename, mime_type, filesize, width, height, focal_x, focal_y, sizes_thumbnail_url, sizes_thumbnail_width, sizes_thumbnail_height, sizes_thumbnail_mime_type, sizes_thumbnail_filesize, sizes_thumbnail_filename, sizes_square_url, sizes_square_width, sizes_square_height, sizes_square_mime_type, sizes_square_filesize, sizes_square_filename, sizes_small_url, sizes_small_width, sizes_small_height, sizes_small_mime_type, sizes_small_filesize, sizes_small_filename, sizes_medium_url, sizes_medium_width, sizes_medium_height, sizes_medium_mime_type, sizes_medium_filesize, sizes_medium_filename, sizes_large_url, sizes_large_width, sizes_large_height, sizes_large_mime_type, sizes_large_filesize, sizes_large_filename, sizes_xlarge_url, sizes_xlarge_width, sizes_xlarge_height, sizes_xlarge_mime_type, sizes_xlarge_filesize, sizes_xlarge_filename, sizes_og_url, sizes_og_width, sizes_og_height, sizes_og_mime_type, sizes_og_filesize, sizes_og_filename) FROM stdin;
1	\N	\N	2025-12-23 20:04:54.318+00	2025-12-23 20:04:54.313+00	\N	\N	kymer.png	image/png	4917317	2160	2880	50	50	\N	300	400	image/png	156146	kymer-300x400.png	\N	500	500	image/png	372460	kymer-500x500.png	\N	600	800	image/png	536418	kymer-600x800.png	\N	900	1200	image/png	1130122	kymer-900x1200.png	\N	1400	1867	image/png	2612387	kymer-1400x1867.png	\N	1920	2560	image/png	4739701	kymer-1920x2560.png	\N	1200	630	image/png	1065062	kymer-1200x630.png
2	\N	\N	2025-12-23 20:18:01.643+00	2025-12-23 20:18:01.641+00	\N	\N	kymer-1.png	image/png	4917317	2160	2880	50	50	\N	300	400	image/png	156146	kymer-1-300x400.png	\N	500	500	image/png	372460	kymer-1-500x500.png	\N	600	800	image/png	536418	kymer-1-600x800.png	\N	900	1200	image/png	1130122	kymer-1-900x1200.png	\N	1400	1867	image/png	2612387	kymer-1-1400x1867.png	\N	1920	2560	image/png	4739701	kymer-1-1920x2560.png	\N	1200	630	image/png	1065062	kymer-1-1200x630.png
3	\N	\N	2025-12-23 20:29:15.492+00	2025-12-23 20:29:15.491+00	\N	\N	kymer-2.png	image/png	4917317	2160	2880	50	50	\N	300	400	image/png	156146	kymer-2-300x400.png	\N	500	500	image/png	372460	kymer-2-500x500.png	\N	600	800	image/png	536418	kymer-2-600x800.png	\N	900	1200	image/png	1130122	kymer-2-900x1200.png	\N	1400	1867	image/png	2612387	kymer-2-1400x1867.png	\N	1920	2560	image/png	4739701	kymer-2-1920x2560.png	\N	1200	630	image/png	1065062	kymer-2-1200x630.png
4	\N	\N	2025-12-23 20:38:30.299+00	2025-12-23 20:38:30.299+00	\N	\N	kymer-3.png	image/png	4917317	2160	2880	50	50	\N	300	400	image/png	156146	kymer-3-300x400.png	\N	500	500	image/png	372460	kymer-3-500x500.png	\N	600	800	image/png	536418	kymer-3-600x800.png	\N	900	1200	image/png	1130122	kymer-3-900x1200.png	\N	1400	1867	image/png	2612387	kymer-3-1400x1867.png	\N	1920	2560	image/png	4739701	kymer-3-1920x2560.png	\N	1200	630	image/png	1065062	kymer-3-1200x630.png
\.


--
-- Data for Name: organization_staff; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.organization_staff (id, person_id, display_name, slug, updated_at, created_at) FROM stdin;
1	179	Another test person	another-test-person	2025-12-22 05:41:50.949+00	2025-12-21 17:10:54.173+00
\.


--
-- Data for Name: organization_staff_roles; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.organization_staff_roles ("order", parent_id, value, id) FROM stdin;
1	1	moderator	2
2	1	event-manager	3
\.


--
-- Data for Name: pages; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages (id, title, hero_type, hero_rich_text, hero_media_id, meta_title, meta_image_id, meta_description, published_at, generate_slug, slug, updated_at, created_at, _status) FROM stdin;
\.


--
-- Data for Name: pages_blocks_content; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages_blocks_content (_order, _parent_id, _path, id, block_name) FROM stdin;
\.


--
-- Data for Name: pages_blocks_content_columns; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages_blocks_content_columns (_order, _parent_id, id, size, rich_text, enable_link, link_type, link_new_tab, link_url, link_label, link_appearance) FROM stdin;
\.


--
-- Data for Name: pages_blocks_cta; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages_blocks_cta (_order, _parent_id, _path, id, rich_text, block_name) FROM stdin;
\.


--
-- Data for Name: pages_blocks_cta_links; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages_blocks_cta_links (_order, _parent_id, id, link_type, link_new_tab, link_url, link_label, link_appearance) FROM stdin;
\.


--
-- Data for Name: pages_blocks_media_block; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages_blocks_media_block (_order, _parent_id, _path, id, media_id, block_name) FROM stdin;
\.


--
-- Data for Name: pages_hero_links; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages_hero_links (_order, _parent_id, id, link_type, link_new_tab, link_url, link_label, link_appearance) FROM stdin;
\.


--
-- Data for Name: pages_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.pages_rels (id, "order", parent_id, path, pages_id) FROM stdin;
\.


--
-- Data for Name: payload_jobs; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_jobs (id, input, completed_at, total_tried, has_error, error, task_slug, queue, wait_until, processing, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: payload_jobs_log; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_jobs_log (_order, _parent_id, id, executed_at, completed_at, task_slug, task_i_d, input, output, state, error) FROM stdin;
\.


--
-- Data for Name: payload_kv; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_kv (id, key, data) FROM stdin;
\.


--
-- Data for Name: payload_locked_documents; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_locked_documents (id, global_slug, updated_at, created_at) FROM stdin;
16	\N	2025-12-25 00:16:28.509+00	2025-12-25 00:16:28.509+00
24	\N	2025-12-25 12:39:42.824+00	2025-12-25 12:37:31.586+00
\.


--
-- Data for Name: payload_locked_documents_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_locked_documents_rels (id, "order", parent_id, path, pages_id, media_id, people_id, teams_id, matches_id, production_id, organization_staff_id, users_id, redirects_id, ignored_duplicates_id, recruitment_listings_id, recruitment_applications_id, invite_links_id, tournament_templates_id, refinement_id, social_posts_id) FROM stdin;
32	\N	16	user	\N	\N	\N	\N	\N	\N	\N	1	\N	\N	\N	\N	\N	\N	\N	\N
47	\N	24	document	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	\N	\N	\N	\N	\N
48	\N	24	user	\N	\N	\N	\N	\N	\N	\N	2	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: payload_migrations; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_migrations (id, name, batch, updated_at, created_at) FROM stdin;
1	dev	-1	2025-12-23 19:11:34.104+00	2025-12-21 02:05:54.174+00
\.


--
-- Data for Name: payload_preferences; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_preferences (id, key, value, updated_at, created_at) FROM stdin;
37	collection-people	{"limit": 10, "editViewType": "default"}	2025-12-25 20:14:58.568+00	2025-12-25 12:14:45.497+00
31	collection-tournament-templates	{"limit": 10, "editViewType": "default"}	2025-12-26 00:01:21.811+00	2025-12-24 20:08:53.923+00
38	collection-teams	{}	2025-12-26 01:35:22.644+00	2025-12-26 01:35:22.644+00
39	collection-people	{}	2025-12-26 01:35:30.382+00	2025-12-26 01:35:30.382+00
3	collection-teams-32	{"fields": {"_index-0": {"tabIndex": 1}}}	2025-12-21 03:02:59.571+00	2025-12-21 03:02:59.573+00
40	collection-matches	{}	2025-12-26 01:35:36.643+00	2025-12-26 01:35:36.642+00
41	global-production-dashboard	{"editViewType": "default"}	2025-12-26 01:35:50.067+00	2025-12-26 01:35:50.069+00
2	collection-teams	{"limit": 25, "editViewType": "default"}	2025-12-26 02:28:22.614+00	2025-12-21 03:02:53.17+00
43	global-social-media-settings	{"editViewType": "default"}	2025-12-26 21:18:59.267+00	2025-12-26 21:18:59.27+00
42	collection-social-posts	{"limit": 10, "editViewType": "default"}	2025-12-26 21:56:50.459+00	2025-12-26 21:10:40.493+00
6	collection-matches	{"limit": 10, "editViewType": "default"}	2025-12-21 04:54:44.724+00	2025-12-21 04:54:33.956+00
9	collection-media	{"editViewType": "default"}	2025-12-21 15:30:37.818+00	2025-12-21 15:30:37.82+00
1	collection-people	{"limit": 10, "editViewType": "default"}	2025-12-21 15:39:01.263+00	2025-12-21 02:58:03.153+00
44	global-social-media-config	{"fields": {"postTemplates": {"collapsed": []}}, "editViewType": "default"}	2025-12-27 00:59:56.034+00	2025-12-26 22:22:26.375+00
7	collection-production	{"limit": 10, "editViewType": "default"}	2025-12-21 16:44:21.714+00	2025-12-21 05:27:00.093+00
5	collection-teams-23	{"fields": {"_index-0": {"tabIndex": 1}}}	2025-12-21 18:20:41.721+00	2025-12-21 04:47:01.6+00
8	collection-organization-staff	{"limit": 10, "editViewType": "default"}	2025-12-21 18:27:58.605+00	2025-12-21 05:27:44.122+00
45	collection-social-posts	{"limit": 10, "editViewType": "default"}	2025-12-27 01:55:31.669+00	2025-12-27 01:48:01.946+00
11	global-data-consistency	{"editViewType": "default"}	2025-12-22 01:48:52.657+00	2025-12-22 01:48:52.659+00
12	global-schedule-generator	{"editViewType": "default"}	2025-12-22 01:48:58.519+00	2025-12-22 01:48:58.521+00
46	global-social-media-settings	{"editViewType": "default"}	2025-12-27 01:55:38.666+00	2025-12-27 01:55:38.67+00
13	collection-production	{"editViewType": "default"}	2025-12-22 14:11:26.207+00	2025-12-22 14:11:23.773+00
15	collection-teams	{"limit": 10, "editViewType": "default"}	2025-12-22 14:11:52.015+00	2025-12-22 14:11:43.949+00
16	collection-organization-staff	{"editViewType": "default"}	2025-12-22 14:15:16.875+00	2025-12-22 14:15:14.984+00
17	global-schedule-generator	{"editViewType": "default"}	2025-12-22 14:15:22.171+00	2025-12-22 14:15:22.172+00
14	collection-matches	{"limit": 10, "editViewType": "default"}	2025-12-22 14:31:39.335+00	2025-12-22 14:11:34.006+00
18	collection-ignored-duplicates	{"limit": 10, "editViewType": "default"}	2025-12-22 16:25:52.841+00	2025-12-22 16:25:30.219+00
19	collection-teams-31	{"fields": {"_index-1": {"tabIndex": 2}}}	2025-12-22 16:46:50.65+00	2025-12-22 16:46:50.651+00
20	collection-teams-24	{"fields": {"_index-1": {"tabIndex": 1}}}	2025-12-22 17:38:05.242+00	2025-12-22 17:27:39.075+00
21	collection-recruitment-listings	{"limit": 10, "editViewType": "default"}	2025-12-23 01:31:49.782+00	2025-12-22 23:59:36.541+00
22	collection-recruitment-applications	{"limit": 10, "editViewType": "default"}	2025-12-23 02:02:37.957+00	2025-12-23 01:25:44.089+00
23	collection-recruitment-listings	{"limit": 25, "editViewType": "default"}	2025-12-23 02:08:53.511+00	2025-12-23 02:08:39.119+00
24	collection-recruitment-applications	{"limit": 10}	2025-12-23 02:38:36.131+00	2025-12-23 02:25:51.854+00
25	collection-recruitment-listings	{}	2025-12-23 02:40:52.629+00	2025-12-23 02:40:52.629+00
26	collection-recruitment-applications	{}	2025-12-23 02:42:08.039+00	2025-12-23 02:42:08.038+00
28	global-user-profile	{"editViewType": "default"}	2025-12-23 19:42:43.042+00	2025-12-23 19:42:43.045+00
29	global-schedule-generator	{"editViewType": "default"}	2025-12-23 20:43:57.659+00	2025-12-23 20:43:57.666+00
27	collection-invite-links	{"limit": 10, "columns": [{"active": true, "accessor": "token"}, {"active": true, "accessor": "role"}, {"active": true, "accessor": "assignedTeams"}, {"active": true, "accessor": "expiresAt"}, {"active": true, "accessor": "status"}, {"active": true, "accessor": "usedAt"}, {"active": false, "accessor": "id"}, {"active": false, "accessor": "email"}, {"active": true, "accessor": "usedBy"}, {"active": false, "accessor": "createdBy"}, {"active": false, "accessor": "copyLink"}, {"active": false, "accessor": "updatedAt"}, {"active": false, "accessor": "createdAt"}], "editViewType": "default"}	2025-12-23 21:15:06.08+00	2025-12-23 19:26:12.578+00
4	collection-users	{"limit": 10, "columns": [{"active": false, "accessor": "avatar"}, {"active": true, "accessor": "name"}, {"active": true, "accessor": "email"}, {"active": true, "accessor": "role"}, {"active": true, "accessor": "assignedTeams"}, {"active": false, "accessor": "id"}, {"active": false, "accessor": "updatedAt"}, {"active": false, "accessor": "createdAt"}, {"active": false, "accessor": "departments.isProductionStaff"}], "editViewType": "default"}	2025-12-24 19:56:21.038+00	2025-12-21 03:48:35.784+00
32	global-production-dashboard	{"editViewType": "default"}	2025-12-24 22:48:33.371+00	2025-12-24 22:48:33.373+00
10	collection-matches-1	{"fields": {"_index-0": {"tabIndex": 2}, "_index-1": {"tabIndex": 4}}}	2025-12-25 00:12:52.406+00	2025-12-21 16:43:15.218+00
30	nav	{"open": true, "groups": {"Recruitment": {"open": true}}}	2025-12-25 00:47:14.962+00	2025-12-24 05:17:01.839+00
35	collection-teams-32	{"fields": {"_index-1": {"tabIndex": 1}}}	2025-12-25 04:59:31.328+00	2025-12-25 04:59:31.331+00
36	global-production-dashboard	{"editViewType": "default"}	2025-12-25 05:02:55.569+00	2025-12-25 05:02:55.572+00
34	collection-tournament-templates	{"limit": 10, "editViewType": "default"}	2025-12-25 12:05:37.63+00	2025-12-25 04:48:31.321+00
\.


--
-- Data for Name: payload_preferences_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.payload_preferences_rels (id, "order", parent_id, path, users_id) FROM stdin;
96	\N	37	user	2
97	\N	31	user	1
5	\N	3	user	1
98	\N	38	user	5
99	\N	39	user	5
100	\N	40	user	5
101	\N	41	user	5
102	\N	2	user	1
104	\N	43	user	1
13	\N	6	user	1
106	\N	42	user	1
18	\N	9	user	1
19	\N	1	user	1
22	\N	7	user	1
24	\N	5	user	1
25	\N	8	user	1
111	\N	44	user	1
28	\N	11	user	1
29	\N	12	user	1
31	\N	13	user	2
114	\N	45	user	5
115	\N	46	user	5
36	\N	15	user	2
38	\N	16	user	2
39	\N	17	user	2
40	\N	14	user	2
43	\N	18	user	1
44	\N	19	user	1
46	\N	20	user	1
51	\N	21	user	1
52	\N	22	user	1
55	\N	23	user	2
57	\N	24	user	2
58	\N	25	user	3
59	\N	26	user	3
61	\N	28	user	3
62	\N	29	user	3
65	\N	27	user	1
78	\N	4	user	1
81	\N	32	user	1
84	\N	10	user	1
85	\N	30	user	1
90	\N	35	user	2
91	\N	36	user	2
93	\N	34	user	2
\.


--
-- Data for Name: people; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.people (id, name, slug, bio, photo_id, social_links_twitter, social_links_twitch, social_links_youtube, social_links_instagram, social_links_tiktok, notes, updated_at, created_at) FROM stdin;
1	wk ♡.ᐟ	wk	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.407+00	2025-12-21 02:41:58.405+00
2	boomed	boomed	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.431+00	2025-12-21 02:41:58.431+00
3	Aircarter	aircarter	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.488+00	2025-12-21 02:41:58.488+00
4	FireCarter	firecarter	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.496+00	2025-12-21 02:41:58.495+00
5	bion	bion	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.539+00	2025-12-21 02:41:58.538+00
6	Watercarter	watercarter	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.567+00	2025-12-21 02:41:58.567+00
7	ferusky	ferusky	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.569+00	2025-12-21 02:41:58.569+00
8	Earthcarter	earthcarter	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.606+00	2025-12-21 02:41:58.606+00
9	kermplays	kermplays	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.614+00	2025-12-21 02:41:58.614+00
10	FireCarti	firecarti	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.618+00	2025-12-21 02:41:58.618+00
11	Malevolence	malevolence	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.728+00	2025-12-21 02:41:58.728+00
12	ShogunApple	shogunapple	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.745+00	2025-12-21 02:41:58.744+00
13	Minecraft Xaph	minecraft-xaph	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.834+00	2025-12-21 02:41:58.834+00
14	romero	romero	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.835+00	2025-12-21 02:41:58.835+00
15	Goosus	goosus	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.838+00	2025-12-21 02:41:58.838+00
16	Yearlyplanet	yearlyplanet	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.85+00	2025-12-21 02:41:58.85+00
17	Potatomanz101	potatomanz101	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.855+00	2025-12-21 02:41:58.855+00
18	Ten	ten	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.859+00	2025-12-21 02:41:58.859+00
19	Rageicz	rageicz	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.864+00	2025-12-21 02:41:58.864+00
20	LinnyBalls	linnyballs	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.883+00	2025-12-21 02:41:58.883+00
21	Visper	visper	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.884+00	2025-12-21 02:41:58.884+00
22	Ant	ant	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.979+00	2025-12-21 02:41:58.978+00
23	Hemizphere	hemizphere	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:58.994+00	2025-12-21 02:41:58.994+00
24	Jollax	jollax	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.012+00	2025-12-21 02:41:59.012+00
25	NervyTitan40	nervytitan40	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.057+00	2025-12-21 02:41:59.057+00
26	Videogamer	videogamer	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.06+00	2025-12-21 02:41:59.06+00
27	Acoaz	acoaz	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.064+00	2025-12-21 02:41:59.064+00
28	Snake	snake	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.071+00	2025-12-21 02:41:59.071+00
29	silent	silent	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.102+00	2025-12-21 02:41:59.102+00
30	Avalonux	avalonux	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.108+00	2025-12-21 02:41:59.107+00
31	DoubleDinks	doubledinks	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.111+00	2025-12-21 02:41:59.111+00
32	Literally Mayhem (Special Idiot)	literally-mayhem-special-idiot	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.202+00	2025-12-21 02:41:59.202+00
33	Trialing	trialing	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.24+00	2025-12-21 02:41:59.24+00
34	Hunter	hunter	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.256+00	2025-12-21 02:41:59.256+00
35	Alex (King Von)	alex-king-von	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.259+00	2025-12-21 02:41:59.258+00
36	Shogai	shogai	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.262+00	2025-12-21 02:41:59.262+00
38	BLKPITY	blkpity	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.3+00	2025-12-21 02:41:59.3+00
39	Happy The Wise	happy-the-wise	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.303+00	2025-12-21 02:41:59.303+00
40	criffle	criffle	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.325+00	2025-12-21 02:41:59.325+00
41	Newports	newports	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.349+00	2025-12-21 02:41:59.348+00
42	AzuL™	azul	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.386+00	2025-12-21 02:41:59.386+00
43	litemash	litemash	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.389+00	2025-12-21 02:41:59.389+00
44	♡ lily ♡	lily	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.397+00	2025-12-21 02:41:59.397+00
45	puck	puck	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.403+00	2025-12-21 02:41:59.403+00
46	Tetnis	tetnis	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.489+00	2025-12-21 02:41:59.489+00
47	Hemisphere	hemisphere	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.51+00	2025-12-21 02:41:59.51+00
48	Geomaster53	geomaster53	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.546+00	2025-12-21 02:41:59.546+00
49	Mako	mako	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.552+00	2025-12-21 02:41:59.552+00
50	Sisuyoo	sisuyoo	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.557+00	2025-12-21 02:41:59.557+00
51	jazer121	jazer121	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.56+00	2025-12-21 02:41:59.56+00
52	salty	salty	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.586+00	2025-12-21 02:41:59.586+00
53	Certified Doom OTP	certified-doom-otp	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.592+00	2025-12-21 02:41:59.592+00
54	Reality	reality	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.683+00	2025-12-21 02:41:59.683+00
55	NightDragon4633	nightdragon4633	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.73+00	2025-12-21 02:41:59.73+00
56	✰★Pocoyo 𝘜𝘸𝘜✰★	pocoyo	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.732+00	2025-12-21 02:41:59.732+00
57	Akuma	akuma	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.733+00	2025-12-21 02:41:59.733+00
58	Salt	salt	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.752+00	2025-12-21 02:41:59.751+00
59	Mystical	mystical	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.754+00	2025-12-21 02:41:59.754+00
60	Creep	creep	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.849+00	2025-12-21 02:41:59.849+00
61	Virgin Xaph	virgin-xaph	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.865+00	2025-12-21 02:41:59.865+00
62	The Brad (Xaph)	the-brad-xaph	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.93+00	2025-12-21 02:41:59.93+00
63	exo	exo	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.931+00	2025-12-21 02:41:59.931+00
64	Lightweight Xaph	lightweight-xaph	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.934+00	2025-12-21 02:41:59.933+00
65	Asian Xaph	asian-xaph	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.936+00	2025-12-21 02:41:59.936+00
66	Fat Xaph	fat-xaph	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.942+00	2025-12-21 02:41:59.942+00
67	Xaphan	xaphan	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.945+00	2025-12-21 02:41:59.945+00
68	Mookie	mookie	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:41:59.964+00	2025-12-21 02:41:59.964+00
69	Hades #1 Fan (Demi)	hades-1-fan-demi	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.07+00	2025-12-21 02:42:00.069+00
70	Public Relations	public-relations	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.072+00	2025-12-21 02:42:00.072+00
71	Blitz	blitz	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.132+00	2025-12-21 02:42:00.132+00
72	Kombat	kombat	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.134+00	2025-12-21 02:42:00.134+00
73	Drowsy!	drowsy	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.136+00	2025-12-21 02:42:00.136+00
74	Scott	scott	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.138+00	2025-12-21 02:42:00.138+00
75	Shaw	shaw	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.141+00	2025-12-21 02:42:00.141+00
76	Scar	scar	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.149+00	2025-12-21 02:42:00.149+00
77	Emma	emma	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.157+00	2025-12-21 02:42:00.157+00
78	Alex (KingVon)	alex-kingvon	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.254+00	2025-12-21 02:42:00.254+00
79	~natu~	natu	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.278+00	2025-12-21 02:42:00.278+00
80	Dahlia	dahlia	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.285+00	2025-12-21 02:42:00.285+00
81	Death	death	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.316+00	2025-12-21 02:42:00.316+00
82	Pandybri <3	pandybri-3	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.318+00	2025-12-21 02:42:00.317+00
83	. Allie.♡	allie	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.335+00	2025-12-21 02:42:00.335+00
84	Goldblooded	goldblooded	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.411+00	2025-12-21 02:42:00.411+00
85	groka	groka	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.442+00	2025-12-21 02:42:00.442+00
86	Kattos	kattos	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.445+00	2025-12-21 02:42:00.445+00
87	Zupo	zupo	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.478+00	2025-12-21 02:42:00.478+00
88	cheeseburger_ow	cheeseburger-ow	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.483+00	2025-12-21 02:42:00.483+00
89	k1m	k1m	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.488+00	2025-12-21 02:42:00.487+00
90	Abce	abce	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.489+00	2025-12-21 02:42:00.489+00
91	Otakaw	otakaw	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.513+00	2025-12-21 02:42:00.513+00
92	Kippy	kippy	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.57+00	2025-12-21 02:42:00.569+00
93	Fudgey	fudgey	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.589+00	2025-12-21 02:42:00.589+00
94	Stormy	stormy	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.608+00	2025-12-21 02:42:00.608+00
95	Wild	wild	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.642+00	2025-12-21 02:42:00.642+00
96	Typical	typical	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.647+00	2025-12-21 02:42:00.647+00
97	Swiffle	swiffle	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.648+00	2025-12-21 02:42:00.648+00
98	Bogeyed bob	bogeyed-bob	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.657+00	2025-12-21 02:42:00.657+00
99	Dæxi	dxi	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.68+00	2025-12-21 02:42:00.68+00
100	haaladeen	haaladeen	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.682+00	2025-12-21 02:42:00.682+00
101	TBD	tbd	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.759+00	2025-12-21 02:42:00.759+00
106	JooJ	jooj	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.808+00	2025-12-21 02:42:00.808+00
111	Apri	apri	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.9+00	2025-12-21 02:42:00.9+00
118	Gucci	gucci	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.054+00	2025-12-21 02:42:01.054+00
124	palloz	palloz	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.184+00	2025-12-21 02:42:01.184+00
128	kiki	kiki	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.321+00	2025-12-21 02:42:01.321+00
133	COOKIE	cookie	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.385+00	2025-12-21 02:42:01.385+00
134	Scetsis	scetsis	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.486+00	2025-12-21 02:42:01.486+00
138	Fallen	fallen	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.544+00	2025-12-21 02:42:01.544+00
142	Enigma	enigma	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.668+00	2025-12-21 02:42:01.668+00
145	siren	siren	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.701+00	2025-12-21 02:42:01.701+00
146	RandomOnions	randomonions	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.769+00	2025-12-21 02:42:01.769+00
147	M43estro	m43estro	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.79+00	2025-12-21 02:42:01.79+00
148	Foo	foo	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.806+00	2025-12-21 02:42:01.806+00
151	Nick	nick	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.866+00	2025-12-21 02:42:01.866+00
166	Shadow builder / roro3434001	shadow-builder-roro3434001	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.3+00	2025-12-21 02:42:02.3+00
167	Apicii	apicii	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.329+00	2025-12-21 02:42:02.329+00
173	Lima	lima	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.654+00	2025-12-21 02:42:02.653+00
175	Sukka	sukka	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.68+00	2025-12-21 02:42:02.679+00
107	Hades	hades	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.812+00	2025-12-21 02:42:00.812+00
108	Goldenninjaprime	goldenninjaprime	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.832+00	2025-12-21 02:42:00.832+00
109	Mauro	mauro	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.851+00	2025-12-21 02:42:00.851+00
110	Mauro Hikuasian	mauro-hikuasian	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.892+00	2025-12-21 02:42:00.892+00
119	Z3tliX	z3tlix	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.062+00	2025-12-21 02:42:01.062+00
121	Shibal	shibal	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.137+00	2025-12-21 02:42:01.137+00
125	Mattie	mattie	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.189+00	2025-12-21 02:42:01.188+00
126	malumcrypt	malumcrypt	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.215+00	2025-12-21 02:42:01.215+00
129	Seo	seo	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.363+00	2025-12-21 02:42:01.363+00
136	3head / Kymer	3head-kymer	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.535+00	2025-12-21 02:42:01.535+00
144	Sym guy	sym-guy	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.678+00	2025-12-21 02:42:01.678+00
149	Infrared [Baller]	infrared-baller	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.86+00	2025-12-21 02:42:01.86+00
156	S3lmer	s3lmer	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.103+00	2025-12-21 02:42:02.102+00
165	Kami	kami	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.297+00	2025-12-21 02:42:02.297+00
112	Euphoria	euphoria	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.905+00	2025-12-21 02:42:00.904+00
120	Grimlock	grimlock	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.068+00	2025-12-21 02:42:01.068+00
122	Buzzj23	buzzj23	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.138+00	2025-12-21 02:42:01.138+00
131	Trial	trial	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.378+00	2025-12-21 02:42:01.378+00
141	Narkas	narkas	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.653+00	2025-12-21 02:42:01.653+00
150	xMichuKick	xmichukick	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.862+00	2025-12-21 02:42:01.862+00
155	Plantonium	plantonium	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.094+00	2025-12-21 02:42:02.094+00
163	Mr Randomizer	mr-randomizer	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.288+00	2025-12-21 02:42:02.288+00
168	Ooga	ooga	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.478+00	2025-12-21 02:42:02.478+00
170	Quirino	quirino	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.588+00	2025-12-21 02:42:02.588+00
171	TheHalo creeper	thehalo-creeper	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.604+00	2025-12-21 02:42:02.604+00
174	manuel.m	manuelm	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.657+00	2025-12-21 02:42:02.657+00
176	Rosita	rosita	\N	\N	\N	\N	\N	\N	tiktok.com	\N	2025-12-23 16:07:09.395+00	2025-12-21 02:42:02.688+00
113	46Kelpie	46kelpie	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.913+00	2025-12-21 02:42:00.913+00
114	Evil	evil	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:00.935+00	2025-12-21 02:42:00.934+00
115	Kymer	kymer	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.001+00	2025-12-21 02:42:01.001+00
116	Sol	sol	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.02+00	2025-12-21 02:42:01.02+00
117	Solar	solar	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.05+00	2025-12-21 02:42:01.05+00
152	Clappn	clappn	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.878+00	2025-12-21 02:42:01.878+00
153	Hope	hope	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.033+00	2025-12-21 02:42:02.033+00
154	Fab	fab	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.091+00	2025-12-21 02:42:02.091+00
162	roro3434001	roro3434001	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.275+00	2025-12-21 02:42:02.275+00
123	Bap demon	bap-demon	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.18+00	2025-12-21 02:42:01.18+00
127	MadBern	madbern	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.224+00	2025-12-21 02:42:01.224+00
132	Raresh	raresh	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.383+00	2025-12-21 02:42:01.383+00
135	Rose (TANK ROSEEEEEEE!!!!)	rose-tank-roseeeeeee	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.501+00	2025-12-21 02:42:01.501+00
157	Paidamwoyo	paidamwoyo	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.114+00	2025-12-21 02:42:02.114+00
158	luckyboy001	luckyboy001	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.137+00	2025-12-21 02:42:02.137+00
159	Pofa	pofa	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.197+00	2025-12-21 02:42:02.197+00
160	storm	storm	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.213+00	2025-12-21 02:42:02.213+00
161	Peke	peke	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.237+00	2025-12-21 02:42:02.237+00
164	Peke / Mr Randomizer	peke-mr-randomizer	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.291+00	2025-12-21 02:42:02.291+00
169	NoirAngel	noirangel	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.58+00	2025-12-21 02:42:02.58+00
172	sky	sky	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:02.648+00	2025-12-21 02:42:02.648+00
130	SuperGreken	supergreken	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.375+00	2025-12-21 02:42:01.375+00
137	xmfe	xmfe	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.539+00	2025-12-21 02:42:01.539+00
139	FlashAttack	flashattack	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.601+00	2025-12-21 02:42:01.601+00
140	Gartgal	gartgal	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.617+00	2025-12-21 02:42:01.617+00
143	Thrown	thrown	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 02:42:01.675+00	2025-12-21 02:42:01.675+00
177	testprod	testprod	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 05:27:23.539+00	2025-12-21 05:27:23.539+00
178	A Large PErson	a-large-person	\N	\N	\N	\N	\N	\N	\N	\N	2025-12-21 15:38:01.798+00	2025-12-21 15:38:01.795+00
179	Another test person	another-test-person	\N	\N	twitter.com	twitch.tv	\N	\N	tiktik.com	\N	2025-12-23 16:17:24.697+00	2025-12-21 17:10:27.27+00
\.


--
-- Data for Name: people_social_links_custom_links; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.people_social_links_custom_links (_order, _parent_id, id, label, url) FROM stdin;
\.


--
-- Data for Name: production; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.production (id, person_id, display_name, slug, type, updated_at, created_at) FROM stdin;
1	177	testprod	testprod	observer-producer-caster	2025-12-21 05:27:40.184+00	2025-12-21 05:27:40.184+00
2	2	boomed	boomed	caster	2025-12-21 15:32:01.445+00	2025-12-21 15:32:01.443+00
3	179	Another test person	another-test-person	observer	2025-12-22 16:48:07.016+00	2025-12-22 16:48:07.016+00
\.


--
-- Data for Name: production_dashboard; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.production_dashboard (id, updated_at, created_at) FROM stdin;
1	2025-12-27 03:15:03.763+00	2025-12-24 22:16:10.61+00
\.


--
-- Data for Name: recruitment_applications; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.recruitment_applications (id, listing_id, discord_handle, about_me, status, internal_notes, archived, updated_at, created_at) FROM stdin;
1	6	volence	Would love to play I've been a good boy for like most of my life looking to get better though and be a great boy.	accepted	\N	f	2025-12-23 02:06:21.382+00	2025-12-23 01:56:02.764+00
2	9	DanTheMan	I've been doing events since I was a kid. This is Child's Play	new	\N	f	2025-12-23 02:07:36.12+00	2025-12-23 02:07:36.119+00
3	9	testing	tes  test test	new	\N	f	2025-12-23 02:38:01.497+00	2025-12-23 02:38:01.496+00
4	10	I need water	Thirsty to drink and stuff	new	\N	f	2025-12-23 02:38:28.246+00	2025-12-23 02:38:28.246+00
\.


--
-- Data for Name: recruitment_listings; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.recruitment_listings (id, category, team_id, role, requirements, status, filled_by_id, created_by_id, updated_at, created_at) FROM stdin;
4	player	27	tank	Really need a tank to play 3 days a week. Must be epic.	open	\N	1	2025-12-23 01:38:20.176+00	2025-12-23 01:38:20.174+00
5	player	23	tank	We're a one trick team, as long as you're GM2+ on your character we'll give you a trial.	open	\N	1	2025-12-23 01:50:55.05+00	2025-12-23 01:50:55.048+00
6	player	27	dps	You need to game.	open	\N	1	2025-12-23 01:52:11.833+00	2025-12-23 01:52:11.831+00
7	team-staff	27	coach	Need to vod 4 times a week.	open	\N	1	2025-12-23 01:53:16.07+00	2025-12-23 01:53:16.07+00
8	org-staff	\N	moderator	Need to mod!	open	\N	1	2025-12-23 01:53:55.124+00	2025-12-23 01:53:55.124+00
9	org-staff	\N	event-manager	All sorts of events	open	\N	1	2025-12-23 01:54:17.588+00	2025-12-23 01:54:17.588+00
10	player	24	dps	Need a damage player	open	\N	2	2025-12-23 02:33:11.918+00	2025-12-23 02:33:11.916+00
\.


--
-- Data for Name: redirects; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.redirects (id, "from", to_type, to_url, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: redirects_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.redirects_rels (id, "order", parent_id, path, pages_id) FROM stdin;
\.


--
-- Data for Name: rules; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.rules (_order, _parent_id, id, region, division, matches_per_week) FROM stdin;
1	6	694c659382a36814aaf3dd9f	NA	Masters	2
2	6	694df186be0b2f4ef22bbea3	NA	Expert	2
3	6	694df1abbe0b2f4ef22bbea9	NA	Advanced	2
4	6	694df1efbe0b2f4ef22bbeaf	NA	Open	2
5	6	694df213be0b2f4ef22bbeb5	SA	Masters	2
\.


--
-- Data for Name: schedule_generator; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.schedule_generator (id, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: slots; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.slots (_order, _parent_id, id, day_of_week, "time", timezone) FROM stdin;
1	694c659382a36814aaf3dd9f	694c65a682a36814aaf3dda1	wednesday	21:00	EST
2	694c659382a36814aaf3dd9f	694c65b282a36814aaf3dda3	friday	21:00	EST
1	694df186be0b2f4ef22bbea3	694df191be0b2f4ef22bbea5	monday	21:00	EST
2	694df186be0b2f4ef22bbea3	694df19fbe0b2f4ef22bbea7	wednesday	21:00	EST
1	694df1abbe0b2f4ef22bbea9	694df1b8be0b2f4ef22bbeab	monday	21:00	EST
2	694df1abbe0b2f4ef22bbea9	694df1c4be0b2f4ef22bbead	wednesday	21:00	EST
1	694df1efbe0b2f4ef22bbeaf	694df1fabe0b2f4ef22bbeb1	monday	21:00	EST
2	694df1efbe0b2f4ef22bbeaf	694df206be0b2f4ef22bbeb3	wednesday	21:00	EST
1	694df213be0b2f4ef22bbeb5	694df223be0b2f4ef22bbeb7	wednesday	18:00	EST
2	694df213be0b2f4ef22bbeb5	694df232be0b2f4ef22bbeb9	friday	18:00	EST
\.


--
-- Data for Name: social_media_config; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.social_media_config (id, weekly_goals_total_posts_per_week, weekly_goals_match_promos, weekly_goals_stream_announcements, weekly_goals_community_engagement, weekly_goals_original_content, content_guidelines, updated_at, created_at) FROM stdin;
1	10	3	2	3	1	\N	2025-12-27 00:58:01.149+00	2025-12-27 00:30:49.176+00
\.


--
-- Data for Name: social_media_config_post_templates; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.social_media_config_post_templates (_order, _parent_id, id, name, post_type, template_text, suggested_media) FROM stdin;
1	1	694f2bc02a57b7457ef2a7a6	Upcoming Match Template	Stream Announcement	Here's our match! {{team_1}} will be taking on {{team_2}}, let's root on {{team_1}}, here at {{url}}!	\N
\.


--
-- Data for Name: social_media_settings; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.social_media_settings (id, updated_at, created_at, weekly_goals_total_posts_per_week, weekly_goals_match_promos, weekly_goals_stream_announcements, weekly_goals_community_engagement, weekly_goals_original_content, content_guidelines) FROM stdin;
1	2025-12-27 03:23:00.736+00	2025-12-26 21:28:20.026+00	10	3	2	3	2	\N
\.


--
-- Data for Name: social_media_settings_post_templates; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.social_media_settings_post_templates (id, _order, _parent_id, name, post_type, template_text, suggested_media) FROM stdin;
\.


--
-- Data for Name: social_posts; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.social_posts (id, content, post_type, platform, scheduled_date, status, assigned_to_id, approved_by_id, related_match_id, notes, updated_at, created_at, title) FROM stdin;
1	Welcome in team shade!	Original Content	Twitter/X	2025-12-27 22:00:00+00	Draft	1	\N	\N	We are waiting for graphics.	2025-12-26 22:07:47.425+00	2025-12-26 21:44:17.358+00	Shade Roster Announcement
3	Here's our match! ELMT Fire will be taking on Evil Water, let's root on ELMT Fire, here at twitch.tv!	Stream Announcement	Twitter/X	\N	Draft	1	\N	\N	\N	2025-12-27 01:42:12.576+00	2025-12-27 01:42:12.574+00	ELMT Fire VS Evil Water
2	Stuff here	Original Content	Twitter/X	2025-12-27 18:00:00+00	Draft	5	\N	\N	\N	2025-12-27 02:09:25.915+00	2025-12-26 22:08:50.775+00	Test 2
\.


--
-- Data for Name: social_posts_media_attachments; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.social_posts_media_attachments (id, _order, _parent_id, media_id, alt_text, url) FROM stdin;
\.


--
-- Data for Name: social_posts_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.social_posts_rels (id, "order", parent_id, path, media_id) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams (id, name, logo, region, rating, theme_color, bio, active, co_captain_id, slug, updated_at, created_at) FROM stdin;
30	Bug	/logos/elmt_bug.png	NA	3K	\N	\N	t	\N	bug	2025-12-21 02:45:33.488+00	2025-12-21 02:45:33.487+00
22	Garden	/logos/elmt_garden.png	NA	FACEIT Masters	\N	\N	t	\N	garden	2025-12-24 22:48:27.439+00	2025-12-21 02:45:32.537+00
32	Heaven	/logos/elmt_heaven.png	SA	FACEIT Masters	\N	\N	t	\N	heaven	2025-12-26 02:28:02.715+00	2025-12-21 02:45:35.005+00
29	Normal	/logos/elmt_normal.png	NA	FACEIT Expert	\N	\N	t	\N	normal	2025-12-26 02:28:15.688+00	2025-12-21 02:45:33.33+00
28	Reality	/logos/elmt_reality.png	NA	3.4K	\N	\N	t	\N	reality	2025-12-26 02:28:38.095+00	2025-12-21 02:45:33.202+00
27	Fighting	/logos/elmt_fighting.png	NA	3.4K	\N	\N	t	\N	fighting	2025-12-26 02:28:46.568+00	2025-12-21 02:45:33.103+00
25	Poison	/logos/elmt_poison.png	NA	4.2K	\N	\N	t	\N	poison	2025-12-26 02:29:03.511+00	2025-12-21 02:45:32.886+00
24	Water	/logos/elmt_water.png	NA	4.5K	\N	\N	t	\N	water	2025-12-26 02:29:22.11+00	2025-12-21 02:45:32.806+00
23	Dragon	/logos/elmt_dragon.png	NA	FACEIT Advanced	\N	\N	t	\N	dragon	2025-12-26 02:49:06.705+00	2025-12-21 02:45:32.692+00
26	Shade	/logos/elmt_shade.png	NA	3.5K	\N	\N	t	\N	shade	2025-12-26 02:49:06.824+00	2025-12-21 02:45:32.985+00
31	Steel	/logos/elmt_steel.png	NA	2.7K	\N	\N	t	\N	steel	2025-12-26 02:49:06.922+00	2025-12-21 02:45:33.638+00
\.


--
-- Data for Name: teams_achievements; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams_achievements (_order, _parent_id, id, achievement) FROM stdin;
1	29	69475f4dbe1da400976ceac0	Faceit S5 Advanced Champions
2	29	69475f4dbe1da400976ceac1	Faceit S6 Expert top 6
\.


--
-- Data for Name: teams_captain; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams_captain (_order, _parent_id, id, person_id) FROM stdin;
1	30	69475f4dbe1da400976ceacf	22
1	22	69475f4cbe1da400976cea7e	3
2	22	69475f4cbe1da400976cea7f	4
1	32	69475f4ebe1da400976ceb75	169
1	29	69475f4dbe1da400976ceac3	61
1	27	69475f4dbe1da400976ceab0	47
1	24	69475f4cbe1da400976cea96	24
1	23	69475f4cbe1da400976cea89	12
1	26	69475f4cbe1da400976ceaa8	41
1	31	69475f4dbe1da400976ceadb	80
2	31	69475f4dbe1da400976ceadc	79
\.


--
-- Data for Name: teams_coaches; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams_coaches (_order, _parent_id, id, person_id) FROM stdin;
1	30	69475f4dbe1da400976ceacd	69
2	30	69475f4dbe1da400976ceace	70
1	22	69475f4cbe1da400976cea7d	2
1	32	69475f4ebe1da400976ceb74	171
1	28	69475f4dbe1da400976ceab9	54
1	27	69475f4dbe1da400976ceaaf	46
1	24	69475f4cbe1da400976cea95	23
2	24	69497f8fc8ae2f34b0331e62	179
1	26	69475f4cbe1da400976ceaa7	40
1	31	69475f4dbe1da400976cead9	78
2	31	69475f4dbe1da400976ceada	34
\.


--
-- Data for Name: teams_manager; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams_manager (_order, _parent_id, id, person_id) FROM stdin;
1	30	69475f4dbe1da400976ceacc	32
1	22	69475f4cbe1da400976cea7c	1
1	32	69475f4ebe1da400976ceb72	169
2	32	69475f4ebe1da400976ceb73	170
1	29	69475f4dbe1da400976ceac2	60
1	28	69475f4dbe1da400976ceab8	38
1	27	69475f4dbe1da400976ceaae	32
1	25	69475f4cbe1da400976cea9f	32
1	24	69475f4cbe1da400976cea94	22
1	23	69475f4cbe1da400976cea88	11
1	26	69475f4cbe1da400976ceaa5	38
2	26	69475f4cbe1da400976ceaa6	39
1	31	69475f4dbe1da400976cead8	30
\.


--
-- Data for Name: teams_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams_rels (id, "order", parent_id, path, tournament_templates_id) FROM stdin;
1	1	22	activeTournaments	6
2	1	32	activeTournaments	6
3	1	29	activeTournaments	6
4	1	28	activeTournaments	6
5	1	27	activeTournaments	6
6	1	25	activeTournaments	6
7	1	24	activeTournaments	6
8	1	23	activeTournaments	6
9	1	26	activeTournaments	6
10	1	31	activeTournaments	6
\.


--
-- Data for Name: teams_roster; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams_roster (_order, _parent_id, id, person_id, role) FROM stdin;
1	22	69475f4cbe1da400976cea80	6	tank
2	22	69475f4cbe1da400976cea81	5	dps
3	22	69475f4cbe1da400976cea82	3	dps
4	22	69475f4cbe1da400976cea83	4	support
5	22	69475f4cbe1da400976cea84	7	support
1	32	69475f4ebe1da400976ceb76	174	tank
2	32	69475f4ebe1da400976ceb77	172	dps
3	32	69475f4ebe1da400976ceb78	173	dps
4	32	69475f4ebe1da400976ceb79	169	support
5	32	69475f4ebe1da400976ceb7a	131	support
1	29	69475f4dbe1da400976ceac4	61	tank
2	29	69475f4dbe1da400976ceac5	62	dps
3	29	69475f4dbe1da400976ceac6	67	dps
4	29	69475f4dbe1da400976ceac7	63	dps
5	29	69475f4dbe1da400976ceac8	65	dps
6	29	69475f4dbe1da400976ceac9	64	support
7	29	69475f4dbe1da400976ceaca	66	support
8	29	69475f4dbe1da400976ceacb	68	support
1	28	69475f4dbe1da400976ceaba	55	tank
2	28	69475f4dbe1da400976ceabb	57	dps
3	28	69475f4dbe1da400976ceabc	56	dps
4	28	69475f4dbe1da400976ceabd	59	support
5	28	69475f4dbe1da400976ceabe	58	support
1	27	69475f4dbe1da400976ceab1	51	tank
2	27	69475f4dbe1da400976ceab2	47	dps
3	27	69475f4dbe1da400976ceab3	48	dps
4	27	69475f4dbe1da400976ceab4	49	support
5	27	69475f4dbe1da400976ceab5	50	support
1	25	69475f4cbe1da400976ceaa0	33	tank
2	25	69475f4cbe1da400976ceaa1	34	dps
3	25	69475f4cbe1da400976ceaa2	36	dps
4	25	69475f4cbe1da400976ceaa3	33	support
5	25	69475f4cbe1da400976ceaa4	35	support
1	24	69475f4cbe1da400976cea97	26	tank
2	24	69475f4cbe1da400976cea98	28	dps
3	24	69475f4cbe1da400976cea99	24	dps
4	24	69475f4cbe1da400976cea9a	27	support
5	24	69475f4cbe1da400976cea9b	25	support
1	23	69475f4cbe1da400976cea8a	13	tank
2	23	69475f4cbe1da400976cea8b	15	tank
3	23	69475f4cbe1da400976cea8c	14	tank
4	23	69475f4cbe1da400976cea8d	16	dps
5	23	69475f4cbe1da400976cea8e	17	dps
6	23	69475f4cbe1da400976cea8f	19	dps
7	23	69475f4cbe1da400976cea90	21	dps
8	23	69475f4cbe1da400976cea91	12	support
9	23	69475f4cbe1da400976cea92	20	support
10	23	69475f4cbe1da400976cea93	18	support
1	26	69475f4cbe1da400976ceaa9	45	tank
2	26	69475f4cbe1da400976ceaaa	41	dps
3	26	69475f4cbe1da400976ceaab	42	dps
4	26	69475f4cbe1da400976ceaac	44	support
5	26	69475f4cbe1da400976ceaad	43	support
1	31	69475f4dbe1da400976ceadd	72	tank
2	31	69475f4dbe1da400976ceade	80	dps
3	31	69475f4dbe1da400976ceadf	81	dps
4	31	69475f4dbe1da400976ceae0	82	support
5	31	69475f4dbe1da400976ceae1	79	support
6	31	694975fd135e869580ae5b88	179	tank
1	30	69475f4dbe1da400976cead0	71	tank
2	30	69475f4dbe1da400976cead1	72	tank
3	30	69475f4dbe1da400976cead2	75	dps
4	30	69475f4dbe1da400976cead3	73	dps
5	30	69475f4dbe1da400976cead4	74	dps
6	30	69475f4dbe1da400976cead5	22	support
7	30	69475f4dbe1da400976cead6	76	support
8	30	69475f4dbe1da400976cead7	77	support
\.


--
-- Data for Name: teams_subs; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.teams_subs (_order, _parent_id, id, person_id) FROM stdin;
1	22	69475f4cbe1da400976cea85	8
2	22	69475f4cbe1da400976cea86	9
3	22	69475f4cbe1da400976cea87	10
1	32	69475f4ebe1da400976ceb7b	176
2	32	69475f4ebe1da400976ceb7c	175
1	28	69475f4dbe1da400976ceabf	38
1	27	69475f4dbe1da400976ceab6	53
2	27	69475f4dbe1da400976ceab7	52
1	24	69475f4cbe1da400976cea9c	31
2	24	69475f4cbe1da400976cea9d	29
3	24	69475f4cbe1da400976cea9e	30
1	31	69475f4dbe1da400976ceae2	83
\.


--
-- Data for Name: tournament_templates; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.tournament_templates (id, name, is_active, updated_at, created_at) FROM stdin;
6	FACEIT Season 7	t	2025-12-26 02:37:04.79+00	2025-12-24 22:14:27.752+00
\.


--
-- Data for Name: tournament_templates_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.tournament_templates_rels (id, "order", parent_id, path, teams_id) FROM stdin;
67	1	6	assignedTeams	23
68	2	6	assignedTeams	22
69	3	6	assignedTeams	24
70	4	6	assignedTeams	25
71	5	6	assignedTeams	26
72	6	6	assignedTeams	27
73	7	6	assignedTeams	29
74	8	6	assignedTeams	32
75	9	6	assignedTeams	31
\.


--
-- Data for Name: tournament_templates_rules; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.tournament_templates_rules (_order, _parent_id, id, reg, div, matches_per_week) FROM stdin;
\.


--
-- Data for Name: tournament_templates_rules_slots; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.tournament_templates_rules_slots (_order, _parent_id, id, day, "time", tz) FROM stdin;
\.


--
-- Data for Name: user_profile; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.user_profile (id, updated_at, created_at) FROM stdin;
1	2025-12-23 19:39:01.382+00	2025-12-23 19:39:01.382+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.users (id, name, role, updated_at, created_at, email, reset_password_token, reset_password_expiration, salt, hash, login_attempts, lock_until, avatar_id, departments_is_production_staff, departments_is_social_media_staff) FROM stdin;
3	Test3	staff-manager	2025-12-23 20:38:30.397+00	2025-12-23 02:40:33.418+00	test3@test.com	\N	\N	2bc80cd1d8807174d0ec194438eefe5ae1718c10e444fc2f74984b7ffdebb95a	93d3db7481650fa07c54480a6fb3d3d9a76294b892af2bb0f0bc095a0c3883e0be0fed84dbf7ffa4ab5bf1bced39dd5657efc5324420bacbc2ca67f5ef2cc3d5d5a032973052a85b8dad255f08bcf7ccb36242a166fe57e2d0708e9268f3555dd3c1db9534fcd689d066504d6412e66da36aa35376986e5d3af88af19cbe87c9e789373230653c6f254acb1e6d2cad9f2153dedfc89488f16e1dae7eea781a34fc2e0de7a06698b967f4737554c2ad12ae35cf94cadf7921a8eb8ea396d44a8a1b9dbff1879934825d80ffe275e9e6fe54c6504d19a88b821396cde52f4aa7183a509ae5e39a39c8e535ec655e670f889b983e21cb3cbd55267809cfd101cbd552e3c32e579898bd6824f7abba0b1d102481c0c62f7a61b0c4d492ff939f50fa155fe7cc5bec05e0b158bf276336e51779e0795e5115abbd56335ee6cb8aac5435675b1e4e276dd88cd49fb2d325911dc1f720cef3d545c3afa1943a275f516ea9733ca4f2e067a274201c32ab6ba223acac9f4ec6f993d33c5687e196416e0f2d7de607d27475aedb5c3af65523806836f895fb02451905d73d69b82fc2e96a042becfd942f78e207375cca8720a914e088db9a9702eed0c2da36d3142e7c4cc64c48eacea1bd36521e1c972e32e938b85436e68b14e4ec6df12d873837b0fbe08cd9de6342f2c09169cbcb159828268baf726bbe4c61ea22199170cdcb13a5	0	\N	4	f	f
4	Test4	team-manager	2025-12-23 21:13:36.714+00	2025-12-23 21:10:58.535+00	test4@test.com	\N	\N	794462db984b51eebf49eb63abb46beb963da82893d97fd5091797b786186fa7	8dc3e1879299bc2c662a6512efcd7d028133d7754635a8565f96641a6e83c8340c8a9b3f6da1cc64a32a329d7c1fd65a0c26483f124343fea054d179b4a47685079b7b7d1b897ec6913d1a08450db96a07cd21032bfb22fdd6a98b144d7ef105daa6a3a6aaf9c676bc3ef7b65b2c7188594020ad2919a26c84ae041db2aa9feacc9062e803e2a427582028e26ab6f7643584c3e7b2e6d35586b29bc73bb2ea85aeb03402e404eaa64ee8046b443b5880f93480add53d28db075e84933dd3a63583b40c19f485a2308614c77610d733f8abc148e619d6708a7e31fd921ba512e3c622ebd6dac686989f1b04add4ecc395d170a48546ac0a1b317430170f4e5d8e42c732fe113e109ce0533f1b3b4fcd3d58206888c8e9b4fbc6ef593960c3a16da05286dea5900082d7987f30c207404c642198d7a7f31f1d11c8b771c7b15c20c2479c88381a7dfecb37e72ef54254d25faa862f85c59461b98965984a02c8fe4676d2e068a458ddcc3cc2a4d18d1fb8e95c204a2f9920cd265cf55777d40cc5f2c35abf081c3280f91145d624158b0e1757f51346640bc698013d969646c709e383c808994851a999d6880513dc0172e845202fdf3b02ff683433f9dd000c4fa1cbaf115b4c3f6816624b7dd6479c87f34de093e20148b04151136e0ff66cd88230228032bf5dc579994cf26c2bb2e616a8a93358b906c7806db738141facdb	0	\N	\N	f	f
2	Test2	team-manager	2025-12-25 04:47:54.776+00	2025-12-22 14:11:04.282+00	test2@test.com	\N	\N	d7f539f57e0ec6cc58884f793f7cfa14294687ca65225e376036b58615796eec	c637968a82c70e1c70ef390909d9bb2d1ffc28b24a2abd5e8facae1b49c8fa8fd6cd2104f9f6e9f9d85d9ac9571ebf8914fc8a72eacc172528d7925bbe00d8b10e746eab15f42d1f8b9f7194f1ac1df7acb38f94cfc32ec5c7ad38b1b91098aa074feeae2d2adef0791c202be194f3515cad86a3f2c7cbd705176ae15ac044fab2da4e57d427918adf038a754ba43b3af5ce4215c6c49b1c52bf65b8721cc3eb8c4829fe73fcdcd289a4121dc8456271819c4a21a5f0687ac7265faef7443e2f53a193efdefd45d4710fab3c5e9c64eafbf16b12c33f4603e001003ede509815de60f8bf18a9ba664fa4377208a7c6f5ebce0ee107abb61492d75aeb8709686ebb27f17556ae1372d12e9e467749e27cd7b5f14750a4e40a9cedd568324af7e30d898e8accd3ce6406029bdcbee7426f5451d34e4da6032287324effaaefdc0f66564d2327b80ecf36522e896d2d172c9fb48deb4a415c9a2c690434713163f37ede96adcf94b6d016d6caadfd5c70c58490ee9bab5908e4e763112ea4de596478bb8856bbde7497edf1c7d0d71df3ae3df8a59ef2ebf1a49146fe8f14ffc511cac39b6858fae6fd3f67edd0abcd65a49af7e93a5cde41102ea2020dab3a4cb53a658ffc496ae8467ac3f9d49531055cfdd949d780115e6667b90e8443b7882e3a1eff4d7684a72e149e2f7a9c6201b0b1518d3b7d935573156b00aa5dc1f973	0	\N	\N	t	f
1	Test	admin	2025-12-21 03:49:51.29+00	2025-12-21 02:35:31.204+00	test@test.com	\N	\N	fae883be1a4ab9443b45d5a00151c434b2a2d593c8f6a27acb1f459014a984ea	26728716aef5310ee2dc378a8c9c06996b7a654e27657d698dc7a4fbb15921a70e48e8d60750e0e7e9e5794145e7e10ffc3a1212ff6c811814a97835d5538aea5b86acd96d8adb32518559cbd937f19c2e729c9e1304d3efeecba31c667c0726304c6e4cb2091ce3bad35ce757d0d0bfc5953b029181f44e5ecc5de4b3449b229aea97385a480ca4175ede807cb563118764d2eccec8066a9d7cc43c37311b79578410946d8426cddb9189785c328471e0870943d5d091332c53d52131be8dce6a760001b86a4adba00b81ceaca04d7506d816fea08d8c11a5ddcdbfaf787a4399eaacc6151a719e351daf5078ba041f69a0bf839fff091a01c6b4a27da00939744645b23de7f4011aae7890c81d7911809e328354965d63ed9b3ba3fe0259c86886504749ddad651645ba944791c02febd165ea380d63fb198f3ed9b2b0c207879d7e50822702815ef09ca2d3363cf830548df5bea947c1a25444750f6cb185e63d902bdcb669de4f6d6ca970744cfeaa9a742fb490c8834ed8c03b12c1b73e402789464f9403cb00254904168da4a86d141febcc841c130b62a94d6ce92baeaa2c8d385a7859a9b8746fc5e11515e4a9fc1297a39f1fb56514fad33516f0bde29471a68320fb3eecaa1c38389662f813da14d7fa9e87cbb22c0870095100096fc3e56e07983df0592286922ee768ba62230627afac287ddaff9a1c4a4cfba5	0	\N	\N	f	f
5	Test5	user	2025-12-27 01:47:40.676+00	2025-12-26 01:34:40.237+00	test5@test.com	\N	\N	218e20d65eac57cffa9798021dc0bdb7519e531629f7d77408b1c5ecfe2af1ea	58c3e8282549a7770ae0539cedbfe410812e5c3d76f0b332ff8abecbaf8c6253e1dd0174e3f2663250994d94a7267319f87ea634e3e540ad3f421b0ae2c746059b714bb592b20f4254d3b87e0134ed200b9fed18425f90106066dd5242aa809d0e887efef4cd8bf9e0b30d821cf1ddce396a82a6fa1bbb7b6f7d021a040d3947b61bf7872d69a11c283aab41a26fe055e79bd101bdb957df95501489ce9cb02420f65a63d784cf97a56f2994ba2e14639817939568b835aa75e6be069c7edd8d7fec913270f119a09abeaf1ec20a69aab117b1a9293dff799fa967e7016fcc5825280db2d2f3506b1805736f24cdf63c85552eb05ebf99f2782dff7112a6a1487e785fa120da8e79af8ae39e77ce104d41122d806d6c70672f6a4545820753dba5331c41c336c40d63b18268e43a81a63d338885817649bc4517d265f56b738185ccb644ba1206e38d1e822ee4855483521066a1d71b138e4501c28307bbea32f67d380e6fb476cc3b8286e4b80204763f2994b4a3d8862b1673b8dcdf007fe3ea1db153056206fc3094c0db68515b6fe2eb6cffb442a6c5a8095780121fbc1dba2471c369a9a8f2adbd27cce2c2cdcc960b992593dba8d544f06988fda1ed49be53b9584b30572f07234085e234d36e56ba2170d9011d6452c79dda4fcd3ec442392d6eb0aedaa912a5df87aed40cd92a53e41c42ef54548447b31ff9ee5fe5	0	\N	\N	t	t
\.


--
-- Data for Name: users_rels; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.users_rels (id, "order", parent_id, path, teams_id) FROM stdin;
125	1	1	assignedTeams	23
73	1	4	assignedTeams	25
74	2	4	assignedTeams	28
106	1	2	assignedTeams	22
107	2	2	assignedTeams	24
55	1	3	assignedTeams	29
\.


--
-- Data for Name: users_sessions; Type: TABLE DATA; Schema: public; Owner: payload
--

COPY public.users_sessions (_order, _parent_id, id, created_at, expires_at) FROM stdin;
1	2	ca5234ed-1572-4d56-ad4d-a6cb1fc57aea	2025-12-25 19:53:13.728+00	2025-12-25 21:53:13.728+00
1	3	79a6cee2-1ef9-4fb8-b2d3-76d3cae42123	2025-12-23 19:26:33.991+00	2025-12-23 21:26:33.991+00
2	3	2f339231-750e-4d3a-9e1a-b5888498664c	2025-12-23 19:57:48.248+00	2025-12-23 21:57:48.248+00
1	1	0f3ae507-0483-451f-aee9-924756f537b2	2025-12-27 04:36:03.839+00	2025-12-27 06:36:03.839+00
\.


--
-- Name: _pages_v_blocks_content_columns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_blocks_content_columns_id_seq', 1, false);


--
-- Name: _pages_v_blocks_content_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_blocks_content_id_seq', 1, false);


--
-- Name: _pages_v_blocks_cta_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_blocks_cta_id_seq', 1, false);


--
-- Name: _pages_v_blocks_cta_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_blocks_cta_links_id_seq', 1, false);


--
-- Name: _pages_v_blocks_media_block_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_blocks_media_block_id_seq', 1, false);


--
-- Name: _pages_v_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_id_seq', 1, false);


--
-- Name: _pages_v_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_rels_id_seq', 1, false);


--
-- Name: _pages_v_version_hero_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public._pages_v_version_hero_links_id_seq', 1, false);


--
-- Name: assigned_c_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.assigned_c_id_seq', 1, false);


--
-- Name: caster_su_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.caster_su_id_seq', 1, false);


--
-- Name: data_consistency_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.data_consistency_id_seq', 1, false);


--
-- Name: footer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.footer_id_seq', 1, false);


--
-- Name: footer_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.footer_rels_id_seq', 1, false);


--
-- Name: header_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.header_id_seq', 1, false);


--
-- Name: header_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.header_rels_id_seq', 1, false);


--
-- Name: ignored_duplicates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.ignored_duplicates_id_seq', 3, true);


--
-- Name: invite_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.invite_links_id_seq', 2, true);


--
-- Name: invite_links_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.invite_links_rels_id_seq', 4, true);


--
-- Name: matches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.matches_id_seq', 43, true);


--
-- Name: matches_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.matches_rels_id_seq', 80, true);


--
-- Name: media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.media_id_seq', 4, true);


--
-- Name: organization_staff_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.organization_staff_id_seq', 1, true);


--
-- Name: organization_staff_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.organization_staff_roles_id_seq', 3, true);


--
-- Name: pages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.pages_id_seq', 1, false);


--
-- Name: pages_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.pages_rels_id_seq', 1, false);


--
-- Name: payload_jobs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.payload_jobs_id_seq', 1, false);


--
-- Name: payload_kv_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.payload_kv_id_seq', 1, false);


--
-- Name: payload_locked_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.payload_locked_documents_id_seq', 43, true);


--
-- Name: payload_locked_documents_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.payload_locked_documents_rels_id_seq', 82, true);


--
-- Name: payload_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.payload_migrations_id_seq', 1, true);


--
-- Name: payload_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.payload_preferences_id_seq', 46, true);


--
-- Name: payload_preferences_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.payload_preferences_rels_id_seq', 115, true);


--
-- Name: people_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.people_id_seq', 179, true);


--
-- Name: production_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.production_id_seq', 3, true);


--
-- Name: recruitment_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.recruitment_applications_id_seq', 4, true);


--
-- Name: recruitment_listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.recruitment_listings_id_seq', 10, true);


--
-- Name: redirects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.redirects_id_seq', 1, false);


--
-- Name: redirects_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.redirects_rels_id_seq', 1, false);


--
-- Name: schedule_generator_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.schedule_generator_id_seq', 1, false);


--
-- Name: social_media_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.social_media_config_id_seq', 1, false);


--
-- Name: social_media_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.social_media_settings_id_seq', 1, true);


--
-- Name: social_media_settings_post_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.social_media_settings_post_templates_id_seq', 1, false);


--
-- Name: social_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.social_posts_id_seq', 3, true);


--
-- Name: social_posts_media_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.social_posts_media_attachments_id_seq', 1, false);


--
-- Name: social_posts_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.social_posts_rels_id_seq', 1, false);


--
-- Name: teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.teams_id_seq', 32, true);


--
-- Name: teams_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.teams_rels_id_seq', 10, true);


--
-- Name: tournament_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.tournament_templates_id_seq', 6, true);


--
-- Name: tournament_templates_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.tournament_templates_rels_id_seq', 75, true);


--
-- Name: user_profile_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.user_profile_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: users_rels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: payload
--

SELECT pg_catalog.setval('public.users_rels_id_seq', 125, true);


--
-- Name: _pages_v_blocks_content_columns _pages_v_blocks_content_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_content_columns
    ADD CONSTRAINT _pages_v_blocks_content_columns_pkey PRIMARY KEY (id);


--
-- Name: _pages_v_blocks_content _pages_v_blocks_content_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_content
    ADD CONSTRAINT _pages_v_blocks_content_pkey PRIMARY KEY (id);


--
-- Name: _pages_v_blocks_cta_links _pages_v_blocks_cta_links_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_cta_links
    ADD CONSTRAINT _pages_v_blocks_cta_links_pkey PRIMARY KEY (id);


--
-- Name: _pages_v_blocks_cta _pages_v_blocks_cta_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_cta
    ADD CONSTRAINT _pages_v_blocks_cta_pkey PRIMARY KEY (id);


--
-- Name: _pages_v_blocks_media_block _pages_v_blocks_media_block_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_media_block
    ADD CONSTRAINT _pages_v_blocks_media_block_pkey PRIMARY KEY (id);


--
-- Name: _pages_v _pages_v_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v
    ADD CONSTRAINT _pages_v_pkey PRIMARY KEY (id);


--
-- Name: _pages_v_rels _pages_v_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_rels
    ADD CONSTRAINT _pages_v_rels_pkey PRIMARY KEY (id);


--
-- Name: _pages_v_version_hero_links _pages_v_version_hero_links_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_version_hero_links
    ADD CONSTRAINT _pages_v_version_hero_links_pkey PRIMARY KEY (id);


--
-- Name: assigned_c assigned_c_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.assigned_c
    ADD CONSTRAINT assigned_c_pkey PRIMARY KEY (id);


--
-- Name: caster_su caster_su_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.caster_su
    ADD CONSTRAINT caster_su_pkey PRIMARY KEY (id);


--
-- Name: data_consistency data_consistency_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.data_consistency
    ADD CONSTRAINT data_consistency_pkey PRIMARY KEY (id);


--
-- Name: footer_nav_items footer_nav_items_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer_nav_items
    ADD CONSTRAINT footer_nav_items_pkey PRIMARY KEY (id);


--
-- Name: footer footer_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer
    ADD CONSTRAINT footer_pkey PRIMARY KEY (id);


--
-- Name: footer_rels footer_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer_rels
    ADD CONSTRAINT footer_rels_pkey PRIMARY KEY (id);


--
-- Name: header_nav_items header_nav_items_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header_nav_items
    ADD CONSTRAINT header_nav_items_pkey PRIMARY KEY (id);


--
-- Name: header header_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header
    ADD CONSTRAINT header_pkey PRIMARY KEY (id);


--
-- Name: header_rels header_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header_rels
    ADD CONSTRAINT header_rels_pkey PRIMARY KEY (id);


--
-- Name: ignored_duplicates ignored_duplicates_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.ignored_duplicates
    ADD CONSTRAINT ignored_duplicates_pkey PRIMARY KEY (id);


--
-- Name: invite_links invite_links_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links
    ADD CONSTRAINT invite_links_pkey PRIMARY KEY (id);


--
-- Name: invite_links_rels invite_links_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links_rels
    ADD CONSTRAINT invite_links_rels_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: matches_rels matches_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.matches_rels
    ADD CONSTRAINT matches_rels_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: organization_staff organization_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.organization_staff
    ADD CONSTRAINT organization_staff_pkey PRIMARY KEY (id);


--
-- Name: organization_staff_roles organization_staff_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.organization_staff_roles
    ADD CONSTRAINT organization_staff_roles_pkey PRIMARY KEY (id);


--
-- Name: pages_blocks_content_columns pages_blocks_content_columns_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_content_columns
    ADD CONSTRAINT pages_blocks_content_columns_pkey PRIMARY KEY (id);


--
-- Name: pages_blocks_content pages_blocks_content_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_content
    ADD CONSTRAINT pages_blocks_content_pkey PRIMARY KEY (id);


--
-- Name: pages_blocks_cta_links pages_blocks_cta_links_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_cta_links
    ADD CONSTRAINT pages_blocks_cta_links_pkey PRIMARY KEY (id);


--
-- Name: pages_blocks_cta pages_blocks_cta_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_cta
    ADD CONSTRAINT pages_blocks_cta_pkey PRIMARY KEY (id);


--
-- Name: pages_blocks_media_block pages_blocks_media_block_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_media_block
    ADD CONSTRAINT pages_blocks_media_block_pkey PRIMARY KEY (id);


--
-- Name: pages_hero_links pages_hero_links_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_hero_links
    ADD CONSTRAINT pages_hero_links_pkey PRIMARY KEY (id);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: pages_rels pages_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_rels
    ADD CONSTRAINT pages_rels_pkey PRIMARY KEY (id);


--
-- Name: payload_jobs_log payload_jobs_log_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_jobs_log
    ADD CONSTRAINT payload_jobs_log_pkey PRIMARY KEY (id);


--
-- Name: payload_jobs payload_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_jobs
    ADD CONSTRAINT payload_jobs_pkey PRIMARY KEY (id);


--
-- Name: payload_kv payload_kv_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_kv
    ADD CONSTRAINT payload_kv_pkey PRIMARY KEY (id);


--
-- Name: payload_locked_documents payload_locked_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents
    ADD CONSTRAINT payload_locked_documents_pkey PRIMARY KEY (id);


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_pkey PRIMARY KEY (id);


--
-- Name: payload_migrations payload_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_migrations
    ADD CONSTRAINT payload_migrations_pkey PRIMARY KEY (id);


--
-- Name: payload_preferences payload_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_preferences
    ADD CONSTRAINT payload_preferences_pkey PRIMARY KEY (id);


--
-- Name: payload_preferences_rels payload_preferences_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: people_social_links_custom_links people_social_links_custom_links_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.people_social_links_custom_links
    ADD CONSTRAINT people_social_links_custom_links_pkey PRIMARY KEY (id);


--
-- Name: production_dashboard production_dashboard_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.production_dashboard
    ADD CONSTRAINT production_dashboard_pkey PRIMARY KEY (id);


--
-- Name: production production_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.production
    ADD CONSTRAINT production_pkey PRIMARY KEY (id);


--
-- Name: recruitment_applications recruitment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_pkey PRIMARY KEY (id);


--
-- Name: recruitment_listings recruitment_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_listings
    ADD CONSTRAINT recruitment_listings_pkey PRIMARY KEY (id);


--
-- Name: redirects redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_pkey PRIMARY KEY (id);


--
-- Name: redirects_rels redirects_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.redirects_rels
    ADD CONSTRAINT redirects_rels_pkey PRIMARY KEY (id);


--
-- Name: rules rules_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_pkey PRIMARY KEY (id);


--
-- Name: schedule_generator schedule_generator_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.schedule_generator
    ADD CONSTRAINT schedule_generator_pkey PRIMARY KEY (id);


--
-- Name: slots slots_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.slots
    ADD CONSTRAINT slots_pkey PRIMARY KEY (id);


--
-- Name: social_media_config social_media_config_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_config
    ADD CONSTRAINT social_media_config_pkey PRIMARY KEY (id);


--
-- Name: social_media_config_post_templates social_media_config_post_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_config_post_templates
    ADD CONSTRAINT social_media_config_post_templates_pkey PRIMARY KEY (id);


--
-- Name: social_media_settings social_media_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_settings
    ADD CONSTRAINT social_media_settings_pkey PRIMARY KEY (id);


--
-- Name: social_media_settings_post_templates social_media_settings_post_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_settings_post_templates
    ADD CONSTRAINT social_media_settings_post_templates_pkey PRIMARY KEY (id);


--
-- Name: social_posts_media_attachments social_posts_media_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_media_attachments
    ADD CONSTRAINT social_posts_media_attachments_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: social_posts_rels social_posts_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_rels
    ADD CONSTRAINT social_posts_rels_pkey PRIMARY KEY (id);


--
-- Name: teams_achievements teams_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_achievements
    ADD CONSTRAINT teams_achievements_pkey PRIMARY KEY (id);


--
-- Name: teams_captain teams_captain_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_captain
    ADD CONSTRAINT teams_captain_pkey PRIMARY KEY (id);


--
-- Name: teams_coaches teams_coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_coaches
    ADD CONSTRAINT teams_coaches_pkey PRIMARY KEY (id);


--
-- Name: teams_manager teams_manager_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_manager
    ADD CONSTRAINT teams_manager_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: teams_rels teams_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_rels
    ADD CONSTRAINT teams_rels_pkey PRIMARY KEY (id);


--
-- Name: teams_roster teams_roster_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_roster
    ADD CONSTRAINT teams_roster_pkey PRIMARY KEY (id);


--
-- Name: teams_subs teams_subs_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_subs
    ADD CONSTRAINT teams_subs_pkey PRIMARY KEY (id);


--
-- Name: tournament_templates tournament_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates
    ADD CONSTRAINT tournament_templates_pkey PRIMARY KEY (id);


--
-- Name: tournament_templates_rels tournament_templates_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rels
    ADD CONSTRAINT tournament_templates_rels_pkey PRIMARY KEY (id);


--
-- Name: tournament_templates_rules tournament_templates_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rules
    ADD CONSTRAINT tournament_templates_rules_pkey PRIMARY KEY (id);


--
-- Name: tournament_templates_rules_slots tournament_templates_rules_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rules_slots
    ADD CONSTRAINT tournament_templates_rules_slots_pkey PRIMARY KEY (id);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users_rels users_rels_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users_rels
    ADD CONSTRAINT users_rels_pkey PRIMARY KEY (id);


--
-- Name: users_sessions users_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users_sessions
    ADD CONSTRAINT users_sessions_pkey PRIMARY KEY (id);


--
-- Name: _pages_v_autosave_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_autosave_idx ON public._pages_v USING btree (autosave);


--
-- Name: _pages_v_blocks_content_columns_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_content_columns_order_idx ON public._pages_v_blocks_content_columns USING btree (_order);


--
-- Name: _pages_v_blocks_content_columns_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_content_columns_parent_id_idx ON public._pages_v_blocks_content_columns USING btree (_parent_id);


--
-- Name: _pages_v_blocks_content_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_content_order_idx ON public._pages_v_blocks_content USING btree (_order);


--
-- Name: _pages_v_blocks_content_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_content_parent_id_idx ON public._pages_v_blocks_content USING btree (_parent_id);


--
-- Name: _pages_v_blocks_content_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_content_path_idx ON public._pages_v_blocks_content USING btree (_path);


--
-- Name: _pages_v_blocks_cta_links_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_cta_links_order_idx ON public._pages_v_blocks_cta_links USING btree (_order);


--
-- Name: _pages_v_blocks_cta_links_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_cta_links_parent_id_idx ON public._pages_v_blocks_cta_links USING btree (_parent_id);


--
-- Name: _pages_v_blocks_cta_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_cta_order_idx ON public._pages_v_blocks_cta USING btree (_order);


--
-- Name: _pages_v_blocks_cta_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_cta_parent_id_idx ON public._pages_v_blocks_cta USING btree (_parent_id);


--
-- Name: _pages_v_blocks_cta_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_cta_path_idx ON public._pages_v_blocks_cta USING btree (_path);


--
-- Name: _pages_v_blocks_media_block_media_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_media_block_media_idx ON public._pages_v_blocks_media_block USING btree (media_id);


--
-- Name: _pages_v_blocks_media_block_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_media_block_order_idx ON public._pages_v_blocks_media_block USING btree (_order);


--
-- Name: _pages_v_blocks_media_block_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_media_block_parent_id_idx ON public._pages_v_blocks_media_block USING btree (_parent_id);


--
-- Name: _pages_v_blocks_media_block_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_blocks_media_block_path_idx ON public._pages_v_blocks_media_block USING btree (_path);


--
-- Name: _pages_v_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_created_at_idx ON public._pages_v USING btree (created_at);


--
-- Name: _pages_v_latest_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_latest_idx ON public._pages_v USING btree (latest);


--
-- Name: _pages_v_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_parent_idx ON public._pages_v USING btree (parent_id);


--
-- Name: _pages_v_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_rels_order_idx ON public._pages_v_rels USING btree ("order");


--
-- Name: _pages_v_rels_pages_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_rels_pages_id_idx ON public._pages_v_rels USING btree (pages_id);


--
-- Name: _pages_v_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_rels_parent_idx ON public._pages_v_rels USING btree (parent_id);


--
-- Name: _pages_v_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_rels_path_idx ON public._pages_v_rels USING btree (path);


--
-- Name: _pages_v_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_updated_at_idx ON public._pages_v USING btree (updated_at);


--
-- Name: _pages_v_version_hero_links_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_hero_links_order_idx ON public._pages_v_version_hero_links USING btree (_order);


--
-- Name: _pages_v_version_hero_links_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_hero_links_parent_id_idx ON public._pages_v_version_hero_links USING btree (_parent_id);


--
-- Name: _pages_v_version_hero_version_hero_media_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_hero_version_hero_media_idx ON public._pages_v USING btree (version_hero_media_id);


--
-- Name: _pages_v_version_meta_version_meta_image_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_meta_version_meta_image_idx ON public._pages_v USING btree (version_meta_image_id);


--
-- Name: _pages_v_version_version__status_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_version__status_idx ON public._pages_v USING btree (version__status);


--
-- Name: _pages_v_version_version_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_version_created_at_idx ON public._pages_v USING btree (version_created_at);


--
-- Name: _pages_v_version_version_slug_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_version_slug_idx ON public._pages_v USING btree (version_slug);


--
-- Name: _pages_v_version_version_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX _pages_v_version_version_updated_at_idx ON public._pages_v USING btree (version_updated_at);


--
-- Name: footer_nav_items_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX footer_nav_items_order_idx ON public.footer_nav_items USING btree (_order);


--
-- Name: footer_nav_items_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX footer_nav_items_parent_id_idx ON public.footer_nav_items USING btree (_parent_id);


--
-- Name: footer_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX footer_rels_order_idx ON public.footer_rels USING btree ("order");


--
-- Name: footer_rels_pages_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX footer_rels_pages_id_idx ON public.footer_rels USING btree (pages_id);


--
-- Name: footer_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX footer_rels_parent_idx ON public.footer_rels USING btree (parent_id);


--
-- Name: footer_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX footer_rels_path_idx ON public.footer_rels USING btree (path);


--
-- Name: header_nav_items_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX header_nav_items_order_idx ON public.header_nav_items USING btree (_order);


--
-- Name: header_nav_items_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX header_nav_items_parent_id_idx ON public.header_nav_items USING btree (_parent_id);


--
-- Name: header_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX header_rels_order_idx ON public.header_rels USING btree ("order");


--
-- Name: header_rels_pages_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX header_rels_pages_id_idx ON public.header_rels USING btree (pages_id);


--
-- Name: header_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX header_rels_parent_idx ON public.header_rels USING btree (parent_id);


--
-- Name: header_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX header_rels_path_idx ON public.header_rels USING btree (path);


--
-- Name: idx_social_media_config_post_templates_order; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_media_config_post_templates_order ON public.social_media_config_post_templates USING btree (_order);


--
-- Name: idx_social_media_config_post_templates_parent; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_media_config_post_templates_parent ON public.social_media_config_post_templates USING btree (_parent_id);


--
-- Name: idx_social_media_settings_post_templates_order; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_media_settings_post_templates_order ON public.social_media_settings_post_templates USING btree (_order);


--
-- Name: idx_social_media_settings_post_templates_parent; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_media_settings_post_templates_parent ON public.social_media_settings_post_templates USING btree (_parent_id);


--
-- Name: idx_social_posts_assigned_to_id; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_posts_assigned_to_id ON public.social_posts USING btree (assigned_to_id);


--
-- Name: idx_social_posts_media_attachments_order; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_posts_media_attachments_order ON public.social_posts_media_attachments USING btree (_order);


--
-- Name: idx_social_posts_media_attachments_parent; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_posts_media_attachments_parent ON public.social_posts_media_attachments USING btree (_parent_id);


--
-- Name: idx_social_posts_rels_parent; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_posts_rels_parent ON public.social_posts_rels USING btree (parent_id);


--
-- Name: idx_social_posts_scheduled_date; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_posts_scheduled_date ON public.social_posts USING btree (scheduled_date);


--
-- Name: idx_social_posts_status; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX idx_social_posts_status ON public.social_posts USING btree (status);


--
-- Name: ignored_duplicates_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX ignored_duplicates_created_at_idx ON public.ignored_duplicates USING btree (created_at);


--
-- Name: ignored_duplicates_person1_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX ignored_duplicates_person1_idx ON public.ignored_duplicates USING btree (person1_id);


--
-- Name: ignored_duplicates_person2_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX ignored_duplicates_person2_idx ON public.ignored_duplicates USING btree (person2_id);


--
-- Name: ignored_duplicates_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX ignored_duplicates_updated_at_idx ON public.ignored_duplicates USING btree (updated_at);


--
-- Name: invite_links_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_created_at_idx ON public.invite_links USING btree (created_at);


--
-- Name: invite_links_created_by_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_created_by_idx ON public.invite_links USING btree (created_by_id);


--
-- Name: invite_links_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_rels_order_idx ON public.invite_links_rels USING btree ("order");


--
-- Name: invite_links_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_rels_parent_idx ON public.invite_links_rels USING btree (parent_id);


--
-- Name: invite_links_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_rels_path_idx ON public.invite_links_rels USING btree (path);


--
-- Name: invite_links_rels_teams_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_rels_teams_id_idx ON public.invite_links_rels USING btree (teams_id);


--
-- Name: invite_links_token_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX invite_links_token_idx ON public.invite_links USING btree (token);


--
-- Name: invite_links_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_updated_at_idx ON public.invite_links USING btree (updated_at);


--
-- Name: invite_links_used_by_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX invite_links_used_by_idx ON public.invite_links USING btree (used_by_id);


--
-- Name: matches_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX matches_created_at_idx ON public.matches USING btree (created_at);


--
-- Name: matches_slug_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX matches_slug_idx ON public.matches USING btree (slug);


--
-- Name: matches_team_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX matches_team_idx ON public.matches USING btree (team_id);


--
-- Name: matches_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX matches_updated_at_idx ON public.matches USING btree (updated_at);


--
-- Name: media_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_created_at_idx ON public.media USING btree (created_at);


--
-- Name: media_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX media_filename_idx ON public.media USING btree (filename);


--
-- Name: media_sizes_large_sizes_large_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_sizes_large_sizes_large_filename_idx ON public.media USING btree (sizes_large_filename);


--
-- Name: media_sizes_medium_sizes_medium_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_sizes_medium_sizes_medium_filename_idx ON public.media USING btree (sizes_medium_filename);


--
-- Name: media_sizes_og_sizes_og_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_sizes_og_sizes_og_filename_idx ON public.media USING btree (sizes_og_filename);


--
-- Name: media_sizes_small_sizes_small_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_sizes_small_sizes_small_filename_idx ON public.media USING btree (sizes_small_filename);


--
-- Name: media_sizes_square_sizes_square_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_sizes_square_sizes_square_filename_idx ON public.media USING btree (sizes_square_filename);


--
-- Name: media_sizes_thumbnail_sizes_thumbnail_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_sizes_thumbnail_sizes_thumbnail_filename_idx ON public.media USING btree (sizes_thumbnail_filename);


--
-- Name: media_sizes_xlarge_sizes_xlarge_filename_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_sizes_xlarge_sizes_xlarge_filename_idx ON public.media USING btree (sizes_xlarge_filename);


--
-- Name: media_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX media_updated_at_idx ON public.media USING btree (updated_at);


--
-- Name: organization_staff_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX organization_staff_created_at_idx ON public.organization_staff USING btree (created_at);


--
-- Name: organization_staff_person_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX organization_staff_person_idx ON public.organization_staff USING btree (person_id);


--
-- Name: organization_staff_roles_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX organization_staff_roles_order_idx ON public.organization_staff_roles USING btree ("order");


--
-- Name: organization_staff_roles_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX organization_staff_roles_parent_idx ON public.organization_staff_roles USING btree (parent_id);


--
-- Name: organization_staff_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX organization_staff_updated_at_idx ON public.organization_staff USING btree (updated_at);


--
-- Name: pages__status_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages__status_idx ON public.pages USING btree (_status);


--
-- Name: pages_blocks_content_columns_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_content_columns_order_idx ON public.pages_blocks_content_columns USING btree (_order);


--
-- Name: pages_blocks_content_columns_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_content_columns_parent_id_idx ON public.pages_blocks_content_columns USING btree (_parent_id);


--
-- Name: pages_blocks_content_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_content_order_idx ON public.pages_blocks_content USING btree (_order);


--
-- Name: pages_blocks_content_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_content_parent_id_idx ON public.pages_blocks_content USING btree (_parent_id);


--
-- Name: pages_blocks_content_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_content_path_idx ON public.pages_blocks_content USING btree (_path);


--
-- Name: pages_blocks_cta_links_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_cta_links_order_idx ON public.pages_blocks_cta_links USING btree (_order);


--
-- Name: pages_blocks_cta_links_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_cta_links_parent_id_idx ON public.pages_blocks_cta_links USING btree (_parent_id);


--
-- Name: pages_blocks_cta_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_cta_order_idx ON public.pages_blocks_cta USING btree (_order);


--
-- Name: pages_blocks_cta_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_cta_parent_id_idx ON public.pages_blocks_cta USING btree (_parent_id);


--
-- Name: pages_blocks_cta_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_cta_path_idx ON public.pages_blocks_cta USING btree (_path);


--
-- Name: pages_blocks_media_block_media_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_media_block_media_idx ON public.pages_blocks_media_block USING btree (media_id);


--
-- Name: pages_blocks_media_block_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_media_block_order_idx ON public.pages_blocks_media_block USING btree (_order);


--
-- Name: pages_blocks_media_block_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_media_block_parent_id_idx ON public.pages_blocks_media_block USING btree (_parent_id);


--
-- Name: pages_blocks_media_block_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_blocks_media_block_path_idx ON public.pages_blocks_media_block USING btree (_path);


--
-- Name: pages_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_created_at_idx ON public.pages USING btree (created_at);


--
-- Name: pages_hero_hero_media_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_hero_hero_media_idx ON public.pages USING btree (hero_media_id);


--
-- Name: pages_hero_links_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_hero_links_order_idx ON public.pages_hero_links USING btree (_order);


--
-- Name: pages_hero_links_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_hero_links_parent_id_idx ON public.pages_hero_links USING btree (_parent_id);


--
-- Name: pages_meta_meta_image_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_meta_meta_image_idx ON public.pages USING btree (meta_image_id);


--
-- Name: pages_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_rels_order_idx ON public.pages_rels USING btree ("order");


--
-- Name: pages_rels_pages_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_rels_pages_id_idx ON public.pages_rels USING btree (pages_id);


--
-- Name: pages_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_rels_parent_idx ON public.pages_rels USING btree (parent_id);


--
-- Name: pages_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_rels_path_idx ON public.pages_rels USING btree (path);


--
-- Name: pages_slug_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX pages_slug_idx ON public.pages USING btree (slug);


--
-- Name: pages_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX pages_updated_at_idx ON public.pages USING btree (updated_at);


--
-- Name: payload_jobs_completed_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_completed_at_idx ON public.payload_jobs USING btree (completed_at);


--
-- Name: payload_jobs_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_created_at_idx ON public.payload_jobs USING btree (created_at);


--
-- Name: payload_jobs_has_error_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_has_error_idx ON public.payload_jobs USING btree (has_error);


--
-- Name: payload_jobs_log_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_log_order_idx ON public.payload_jobs_log USING btree (_order);


--
-- Name: payload_jobs_log_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_log_parent_id_idx ON public.payload_jobs_log USING btree (_parent_id);


--
-- Name: payload_jobs_processing_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_processing_idx ON public.payload_jobs USING btree (processing);


--
-- Name: payload_jobs_queue_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_queue_idx ON public.payload_jobs USING btree (queue);


--
-- Name: payload_jobs_task_slug_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_task_slug_idx ON public.payload_jobs USING btree (task_slug);


--
-- Name: payload_jobs_total_tried_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_total_tried_idx ON public.payload_jobs USING btree (total_tried);


--
-- Name: payload_jobs_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_updated_at_idx ON public.payload_jobs USING btree (updated_at);


--
-- Name: payload_jobs_wait_until_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_jobs_wait_until_idx ON public.payload_jobs USING btree (wait_until);


--
-- Name: payload_kv_key_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX payload_kv_key_idx ON public.payload_kv USING btree (key);


--
-- Name: payload_locked_documents_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_created_at_idx ON public.payload_locked_documents USING btree (created_at);


--
-- Name: payload_locked_documents_global_slug_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_global_slug_idx ON public.payload_locked_documents USING btree (global_slug);


--
-- Name: payload_locked_documents_rels_ignored_duplicates_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_ignored_duplicates_id_idx ON public.payload_locked_documents_rels USING btree (ignored_duplicates_id);


--
-- Name: payload_locked_documents_rels_invite_links_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_invite_links_id_idx ON public.payload_locked_documents_rels USING btree (invite_links_id);


--
-- Name: payload_locked_documents_rels_matches_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_matches_id_idx ON public.payload_locked_documents_rels USING btree (matches_id);


--
-- Name: payload_locked_documents_rels_media_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_media_id_idx ON public.payload_locked_documents_rels USING btree (media_id);


--
-- Name: payload_locked_documents_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_order_idx ON public.payload_locked_documents_rels USING btree ("order");


--
-- Name: payload_locked_documents_rels_organization_staff_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_organization_staff_id_idx ON public.payload_locked_documents_rels USING btree (organization_staff_id);


--
-- Name: payload_locked_documents_rels_pages_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_pages_id_idx ON public.payload_locked_documents_rels USING btree (pages_id);


--
-- Name: payload_locked_documents_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_parent_idx ON public.payload_locked_documents_rels USING btree (parent_id);


--
-- Name: payload_locked_documents_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_path_idx ON public.payload_locked_documents_rels USING btree (path);


--
-- Name: payload_locked_documents_rels_people_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_people_id_idx ON public.payload_locked_documents_rels USING btree (people_id);


--
-- Name: payload_locked_documents_rels_production_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_production_id_idx ON public.payload_locked_documents_rels USING btree (production_id);


--
-- Name: payload_locked_documents_rels_recruitment_applications_i_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_recruitment_applications_i_idx ON public.payload_locked_documents_rels USING btree (recruitment_applications_id);


--
-- Name: payload_locked_documents_rels_recruitment_listings_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_recruitment_listings_id_idx ON public.payload_locked_documents_rels USING btree (recruitment_listings_id);


--
-- Name: payload_locked_documents_rels_redirects_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_redirects_id_idx ON public.payload_locked_documents_rels USING btree (redirects_id);


--
-- Name: payload_locked_documents_rels_teams_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_teams_id_idx ON public.payload_locked_documents_rels USING btree (teams_id);


--
-- Name: payload_locked_documents_rels_users_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_rels_users_id_idx ON public.payload_locked_documents_rels USING btree (users_id);


--
-- Name: payload_locked_documents_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_locked_documents_updated_at_idx ON public.payload_locked_documents USING btree (updated_at);


--
-- Name: payload_migrations_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_migrations_created_at_idx ON public.payload_migrations USING btree (created_at);


--
-- Name: payload_migrations_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_migrations_updated_at_idx ON public.payload_migrations USING btree (updated_at);


--
-- Name: payload_preferences_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_preferences_created_at_idx ON public.payload_preferences USING btree (created_at);


--
-- Name: payload_preferences_key_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_preferences_key_idx ON public.payload_preferences USING btree (key);


--
-- Name: payload_preferences_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_preferences_rels_order_idx ON public.payload_preferences_rels USING btree ("order");


--
-- Name: payload_preferences_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_preferences_rels_parent_idx ON public.payload_preferences_rels USING btree (parent_id);


--
-- Name: payload_preferences_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_preferences_rels_path_idx ON public.payload_preferences_rels USING btree (path);


--
-- Name: payload_preferences_rels_users_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_preferences_rels_users_id_idx ON public.payload_preferences_rels USING btree (users_id);


--
-- Name: payload_preferences_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX payload_preferences_updated_at_idx ON public.payload_preferences USING btree (updated_at);


--
-- Name: people_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX people_created_at_idx ON public.people USING btree (created_at);


--
-- Name: people_photo_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX people_photo_idx ON public.people USING btree (photo_id);


--
-- Name: people_slug_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX people_slug_idx ON public.people USING btree (slug);


--
-- Name: people_social_links_custom_links_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX people_social_links_custom_links_order_idx ON public.people_social_links_custom_links USING btree (_order);


--
-- Name: people_social_links_custom_links_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX people_social_links_custom_links_parent_id_idx ON public.people_social_links_custom_links USING btree (_parent_id);


--
-- Name: people_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX people_updated_at_idx ON public.people USING btree (updated_at);


--
-- Name: production_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX production_created_at_idx ON public.production USING btree (created_at);


--
-- Name: production_person_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX production_person_idx ON public.production USING btree (person_id);


--
-- Name: production_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX production_updated_at_idx ON public.production USING btree (updated_at);


--
-- Name: recruitment_applications_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_applications_created_at_idx ON public.recruitment_applications USING btree (created_at);


--
-- Name: recruitment_applications_listing_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_applications_listing_idx ON public.recruitment_applications USING btree (listing_id);


--
-- Name: recruitment_applications_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_applications_updated_at_idx ON public.recruitment_applications USING btree (updated_at);


--
-- Name: recruitment_listings_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_listings_created_at_idx ON public.recruitment_listings USING btree (created_at);


--
-- Name: recruitment_listings_created_by_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_listings_created_by_idx ON public.recruitment_listings USING btree (created_by_id);


--
-- Name: recruitment_listings_filled_by_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_listings_filled_by_idx ON public.recruitment_listings USING btree (filled_by_id);


--
-- Name: recruitment_listings_team_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_listings_team_idx ON public.recruitment_listings USING btree (team_id);


--
-- Name: recruitment_listings_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX recruitment_listings_updated_at_idx ON public.recruitment_listings USING btree (updated_at);


--
-- Name: redirects_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX redirects_created_at_idx ON public.redirects USING btree (created_at);


--
-- Name: redirects_from_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX redirects_from_idx ON public.redirects USING btree ("from");


--
-- Name: redirects_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX redirects_rels_order_idx ON public.redirects_rels USING btree ("order");


--
-- Name: redirects_rels_pages_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX redirects_rels_pages_id_idx ON public.redirects_rels USING btree (pages_id);


--
-- Name: redirects_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX redirects_rels_parent_idx ON public.redirects_rels USING btree (parent_id);


--
-- Name: redirects_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX redirects_rels_path_idx ON public.redirects_rels USING btree (path);


--
-- Name: redirects_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX redirects_updated_at_idx ON public.redirects USING btree (updated_at);


--
-- Name: teams_achievements_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_achievements_order_idx ON public.teams_achievements USING btree (_order);


--
-- Name: teams_achievements_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_achievements_parent_id_idx ON public.teams_achievements USING btree (_parent_id);


--
-- Name: teams_captain_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_captain_order_idx ON public.teams_captain USING btree (_order);


--
-- Name: teams_captain_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_captain_parent_id_idx ON public.teams_captain USING btree (_parent_id);


--
-- Name: teams_captain_person_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_captain_person_idx ON public.teams_captain USING btree (person_id);


--
-- Name: teams_co_captain_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_co_captain_idx ON public.teams USING btree (co_captain_id);


--
-- Name: teams_coaches_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_coaches_order_idx ON public.teams_coaches USING btree (_order);


--
-- Name: teams_coaches_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_coaches_parent_id_idx ON public.teams_coaches USING btree (_parent_id);


--
-- Name: teams_coaches_person_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_coaches_person_idx ON public.teams_coaches USING btree (person_id);


--
-- Name: teams_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_created_at_idx ON public.teams USING btree (created_at);


--
-- Name: teams_manager_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_manager_order_idx ON public.teams_manager USING btree (_order);


--
-- Name: teams_manager_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_manager_parent_id_idx ON public.teams_manager USING btree (_parent_id);


--
-- Name: teams_manager_person_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_manager_person_idx ON public.teams_manager USING btree (person_id);


--
-- Name: teams_rels_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_rels_parent_id_idx ON public.teams_rels USING btree (parent_id);


--
-- Name: teams_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_rels_path_idx ON public.teams_rels USING btree (path);


--
-- Name: teams_roster_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_roster_order_idx ON public.teams_roster USING btree (_order);


--
-- Name: teams_roster_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_roster_parent_id_idx ON public.teams_roster USING btree (_parent_id);


--
-- Name: teams_roster_person_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_roster_person_idx ON public.teams_roster USING btree (person_id);


--
-- Name: teams_subs_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_subs_order_idx ON public.teams_subs USING btree (_order);


--
-- Name: teams_subs_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_subs_parent_id_idx ON public.teams_subs USING btree (_parent_id);


--
-- Name: teams_subs_person_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_subs_person_idx ON public.teams_subs USING btree (person_id);


--
-- Name: teams_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX teams_updated_at_idx ON public.teams USING btree (updated_at);


--
-- Name: users_avatar_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_avatar_idx ON public.users USING btree (avatar_id);


--
-- Name: users_created_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_created_at_idx ON public.users USING btree (created_at);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_rels_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_rels_order_idx ON public.users_rels USING btree ("order");


--
-- Name: users_rels_parent_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_rels_parent_idx ON public.users_rels USING btree (parent_id);


--
-- Name: users_rels_path_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_rels_path_idx ON public.users_rels USING btree (path);


--
-- Name: users_rels_teams_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_rels_teams_id_idx ON public.users_rels USING btree (teams_id);


--
-- Name: users_sessions_order_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_sessions_order_idx ON public.users_sessions USING btree (_order);


--
-- Name: users_sessions_parent_id_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_sessions_parent_id_idx ON public.users_sessions USING btree (_parent_id);


--
-- Name: users_updated_at_idx; Type: INDEX; Schema: public; Owner: payload
--

CREATE INDEX users_updated_at_idx ON public.users USING btree (updated_at);


--
-- Name: _pages_v_blocks_content_columns _pages_v_blocks_content_columns_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_content_columns
    ADD CONSTRAINT _pages_v_blocks_content_columns_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v_blocks_content(id) ON DELETE CASCADE;


--
-- Name: _pages_v_blocks_content _pages_v_blocks_content_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_content
    ADD CONSTRAINT _pages_v_blocks_content_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;


--
-- Name: _pages_v_blocks_cta_links _pages_v_blocks_cta_links_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_cta_links
    ADD CONSTRAINT _pages_v_blocks_cta_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v_blocks_cta(id) ON DELETE CASCADE;


--
-- Name: _pages_v_blocks_cta _pages_v_blocks_cta_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_cta
    ADD CONSTRAINT _pages_v_blocks_cta_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;


--
-- Name: _pages_v_blocks_media_block _pages_v_blocks_media_block_media_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_media_block
    ADD CONSTRAINT _pages_v_blocks_media_block_media_id_media_id_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: _pages_v_blocks_media_block _pages_v_blocks_media_block_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_blocks_media_block
    ADD CONSTRAINT _pages_v_blocks_media_block_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;


--
-- Name: _pages_v _pages_v_parent_id_pages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v
    ADD CONSTRAINT _pages_v_parent_id_pages_id_fk FOREIGN KEY (parent_id) REFERENCES public.pages(id) ON DELETE SET NULL;


--
-- Name: _pages_v_rels _pages_v_rels_pages_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_rels
    ADD CONSTRAINT _pages_v_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: _pages_v_rels _pages_v_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_rels
    ADD CONSTRAINT _pages_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;


--
-- Name: _pages_v_version_hero_links _pages_v_version_hero_links_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v_version_hero_links
    ADD CONSTRAINT _pages_v_version_hero_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public._pages_v(id) ON DELETE CASCADE;


--
-- Name: _pages_v _pages_v_version_hero_media_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v
    ADD CONSTRAINT _pages_v_version_hero_media_id_media_id_fk FOREIGN KEY (version_hero_media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: _pages_v _pages_v_version_meta_image_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public._pages_v
    ADD CONSTRAINT _pages_v_version_meta_image_id_media_id_fk FOREIGN KEY (version_meta_image_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: footer_nav_items footer_nav_items_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer_nav_items
    ADD CONSTRAINT footer_nav_items_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.footer(id) ON DELETE CASCADE;


--
-- Name: footer_rels footer_rels_pages_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer_rels
    ADD CONSTRAINT footer_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: footer_rels footer_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.footer_rels
    ADD CONSTRAINT footer_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.footer(id) ON DELETE CASCADE;


--
-- Name: header_nav_items header_nav_items_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header_nav_items
    ADD CONSTRAINT header_nav_items_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.header(id) ON DELETE CASCADE;


--
-- Name: header_rels header_rels_pages_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header_rels
    ADD CONSTRAINT header_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: header_rels header_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.header_rels
    ADD CONSTRAINT header_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.header(id) ON DELETE CASCADE;


--
-- Name: ignored_duplicates ignored_duplicates_person1_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.ignored_duplicates
    ADD CONSTRAINT ignored_duplicates_person1_id_people_id_fk FOREIGN KEY (person1_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: ignored_duplicates ignored_duplicates_person2_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.ignored_duplicates
    ADD CONSTRAINT ignored_duplicates_person2_id_people_id_fk FOREIGN KEY (person2_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: invite_links invite_links_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links
    ADD CONSTRAINT invite_links_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invite_links_rels invite_links_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links_rels
    ADD CONSTRAINT invite_links_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.invite_links(id) ON DELETE CASCADE;


--
-- Name: invite_links_rels invite_links_rels_teams_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links_rels
    ADD CONSTRAINT invite_links_rels_teams_fk FOREIGN KEY (teams_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: invite_links invite_links_used_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.invite_links
    ADD CONSTRAINT invite_links_used_by_id_users_id_fk FOREIGN KEY (used_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: matches matches_team_id_teams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: organization_staff organization_staff_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.organization_staff
    ADD CONSTRAINT organization_staff_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: organization_staff_roles organization_staff_roles_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.organization_staff_roles
    ADD CONSTRAINT organization_staff_roles_parent_fk FOREIGN KEY (parent_id) REFERENCES public.organization_staff(id) ON DELETE CASCADE;


--
-- Name: pages_blocks_content_columns pages_blocks_content_columns_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_content_columns
    ADD CONSTRAINT pages_blocks_content_columns_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages_blocks_content(id) ON DELETE CASCADE;


--
-- Name: pages_blocks_content pages_blocks_content_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_content
    ADD CONSTRAINT pages_blocks_content_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: pages_blocks_cta_links pages_blocks_cta_links_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_cta_links
    ADD CONSTRAINT pages_blocks_cta_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages_blocks_cta(id) ON DELETE CASCADE;


--
-- Name: pages_blocks_cta pages_blocks_cta_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_cta
    ADD CONSTRAINT pages_blocks_cta_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: pages_blocks_media_block pages_blocks_media_block_media_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_media_block
    ADD CONSTRAINT pages_blocks_media_block_media_id_media_id_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: pages_blocks_media_block pages_blocks_media_block_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_blocks_media_block
    ADD CONSTRAINT pages_blocks_media_block_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: pages_hero_links pages_hero_links_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_hero_links
    ADD CONSTRAINT pages_hero_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: pages pages_hero_media_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_hero_media_id_media_id_fk FOREIGN KEY (hero_media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: pages pages_meta_image_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_meta_image_id_media_id_fk FOREIGN KEY (meta_image_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: pages_rels pages_rels_pages_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_rels
    ADD CONSTRAINT pages_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: pages_rels pages_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.pages_rels
    ADD CONSTRAINT pages_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: payload_jobs_log payload_jobs_log_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_jobs_log
    ADD CONSTRAINT payload_jobs_log_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.payload_jobs(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_ignored_duplicates_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_ignored_duplicates_fk FOREIGN KEY (ignored_duplicates_id) REFERENCES public.ignored_duplicates(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_invite_links_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_invite_links_fk FOREIGN KEY (invite_links_id) REFERENCES public.invite_links(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_matches_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_matches_fk FOREIGN KEY (matches_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_media_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_media_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_organization_staff_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_organization_staff_fk FOREIGN KEY (organization_staff_id) REFERENCES public.organization_staff(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_pages_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_locked_documents(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_people_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_people_fk FOREIGN KEY (people_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_production_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_production_fk FOREIGN KEY (production_id) REFERENCES public.production(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_recruitment_applications_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_recruitment_applications_fk FOREIGN KEY (recruitment_applications_id) REFERENCES public.recruitment_applications(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_recruitment_listings_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_recruitment_listings_fk FOREIGN KEY (recruitment_listings_id) REFERENCES public.recruitment_listings(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_redirects_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_redirects_fk FOREIGN KEY (redirects_id) REFERENCES public.redirects(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_teams_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_teams_fk FOREIGN KEY (teams_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: payload_locked_documents_rels payload_locked_documents_rels_users_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payload_preferences_rels payload_preferences_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_preferences(id) ON DELETE CASCADE;


--
-- Name: payload_preferences_rels payload_preferences_rels_users_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.payload_preferences_rels
    ADD CONSTRAINT payload_preferences_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: people people_photo_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_photo_id_media_id_fk FOREIGN KEY (photo_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: people_social_links_custom_links people_social_links_custom_links_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.people_social_links_custom_links
    ADD CONSTRAINT people_social_links_custom_links_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: production production_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.production
    ADD CONSTRAINT production_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: recruitment_applications recruitment_applications_listing_id_recruitment_listings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_applications
    ADD CONSTRAINT recruitment_applications_listing_id_recruitment_listings_id_fk FOREIGN KEY (listing_id) REFERENCES public.recruitment_listings(id) ON DELETE SET NULL;


--
-- Name: recruitment_listings recruitment_listings_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_listings
    ADD CONSTRAINT recruitment_listings_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: recruitment_listings recruitment_listings_filled_by_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_listings
    ADD CONSTRAINT recruitment_listings_filled_by_id_people_id_fk FOREIGN KEY (filled_by_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: recruitment_listings recruitment_listings_team_id_teams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.recruitment_listings
    ADD CONSTRAINT recruitment_listings_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: redirects_rels redirects_rels_pages_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.redirects_rels
    ADD CONSTRAINT redirects_rels_pages_fk FOREIGN KEY (pages_id) REFERENCES public.pages(id) ON DELETE CASCADE;


--
-- Name: redirects_rels redirects_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.redirects_rels
    ADD CONSTRAINT redirects_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.redirects(id) ON DELETE CASCADE;


--
-- Name: rules rules_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.rules
    ADD CONSTRAINT rules_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.tournament_templates(id) ON DELETE CASCADE;


--
-- Name: slots slots_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.slots
    ADD CONSTRAINT slots_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.rules(id) ON DELETE CASCADE;


--
-- Name: social_media_config_post_templates social_media_config_post_templates__parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_config_post_templates
    ADD CONSTRAINT social_media_config_post_templates__parent_id_fkey FOREIGN KEY (_parent_id) REFERENCES public.social_media_config(id) ON DELETE CASCADE;


--
-- Name: social_media_settings_post_templates social_media_settings_post_templates__parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_media_settings_post_templates
    ADD CONSTRAINT social_media_settings_post_templates__parent_id_fkey FOREIGN KEY (_parent_id) REFERENCES public.social_media_settings(id) ON DELETE CASCADE;


--
-- Name: social_posts social_posts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_approved_by_fkey FOREIGN KEY (approved_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: social_posts social_posts_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_assigned_to_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: social_posts_media_attachments social_posts_media_attachments__parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_media_attachments
    ADD CONSTRAINT social_posts_media_attachments__parent_id_fkey FOREIGN KEY (_parent_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;


--
-- Name: social_posts_media_attachments social_posts_media_attachments_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_media_attachments
    ADD CONSTRAINT social_posts_media_attachments_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: social_posts social_posts_related_match_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_related_match_fkey FOREIGN KEY (related_match_id) REFERENCES public.matches(id) ON DELETE SET NULL;


--
-- Name: social_posts_rels social_posts_rels_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_rels
    ADD CONSTRAINT social_posts_rels_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;


--
-- Name: social_posts_rels social_posts_rels_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.social_posts_rels
    ADD CONSTRAINT social_posts_rels_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;


--
-- Name: teams_achievements teams_achievements_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_achievements
    ADD CONSTRAINT teams_achievements_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams_captain teams_captain_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_captain
    ADD CONSTRAINT teams_captain_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams_captain teams_captain_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_captain
    ADD CONSTRAINT teams_captain_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: teams teams_co_captain_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_co_captain_id_people_id_fk FOREIGN KEY (co_captain_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: teams_coaches teams_coaches_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_coaches
    ADD CONSTRAINT teams_coaches_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams_coaches teams_coaches_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_coaches
    ADD CONSTRAINT teams_coaches_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: teams_manager teams_manager_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_manager
    ADD CONSTRAINT teams_manager_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams_manager teams_manager_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_manager
    ADD CONSTRAINT teams_manager_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: teams_rels teams_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_rels
    ADD CONSTRAINT teams_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams_rels teams_rels_tournament_templates_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_rels
    ADD CONSTRAINT teams_rels_tournament_templates_fk FOREIGN KEY (tournament_templates_id) REFERENCES public.tournament_templates(id) ON DELETE CASCADE;


--
-- Name: teams_roster teams_roster_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_roster
    ADD CONSTRAINT teams_roster_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams_roster teams_roster_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_roster
    ADD CONSTRAINT teams_roster_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: teams_subs teams_subs_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_subs
    ADD CONSTRAINT teams_subs_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: teams_subs teams_subs_person_id_people_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.teams_subs
    ADD CONSTRAINT teams_subs_person_id_people_id_fk FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: tournament_templates_rels tournament_templates_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rels
    ADD CONSTRAINT tournament_templates_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.tournament_templates(id) ON DELETE CASCADE;


--
-- Name: tournament_templates_rels tournament_templates_rels_teams_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rels
    ADD CONSTRAINT tournament_templates_rels_teams_fk FOREIGN KEY (teams_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: tournament_templates_rules tournament_templates_rules_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rules
    ADD CONSTRAINT tournament_templates_rules_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.tournament_templates(id) ON DELETE CASCADE;


--
-- Name: tournament_templates_rules_slots tournament_templates_rules_slots_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.tournament_templates_rules_slots
    ADD CONSTRAINT tournament_templates_rules_slots_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.tournament_templates_rules(id) ON DELETE CASCADE;


--
-- Name: users users_avatar_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_avatar_id_media_id_fk FOREIGN KEY (avatar_id) REFERENCES public.media(id) ON DELETE SET NULL;


--
-- Name: users_rels users_rels_parent_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users_rels
    ADD CONSTRAINT users_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users_rels users_rels_teams_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users_rels
    ADD CONSTRAINT users_rels_teams_fk FOREIGN KEY (teams_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: users_sessions users_sessions_parent_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: payload
--

ALTER TABLE ONLY public.users_sessions
    ADD CONSTRAINT users_sessions_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict FdclvnItJrYoaI9iFSQtQoEXSOr4RsQ1DtthJUzKWbdNjOFugR3NRRAxtDKPlSY

