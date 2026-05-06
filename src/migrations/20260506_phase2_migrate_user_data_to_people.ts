import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  // Step 1: Merge User auth/role/department fields into People via mapping table
  await payload.db.drizzle.execute(sql`
    UPDATE people p SET
      email = u.email,
      hash = u.hash,
      salt = u.salt,
      reset_password_token = u.reset_password_token,
      reset_password_expiration = u.reset_password_expiration,
      login_attempts = u.login_attempts,
      lock_until = u.lock_until,
      role = u.role::text::enum_people_role,
      avatar_id = u.avatar_id,
      discord_id = COALESCE(p.discord_id, u.discord_id),
      departments_is_production_staff = COALESCE(u.departments_is_production_staff, false),
      departments_is_social_media_staff = COALESCE(u.departments_is_social_media_staff, false),
      departments_is_graphics_staff = COALESCE(u.departments_is_graphics_staff, false),
      departments_is_video_staff = COALESCE(u.departments_is_video_staff, false),
      departments_is_events_staff = COALESCE(u.departments_is_events_staff, false),
      departments_is_scouting_staff = COALESCE(u.departments_is_scouting_staff, false),
      departments_is_content_creator = COALESCE(u.departments_is_content_creator, false),
      departments_is_pug_admin = COALESCE(u.departments_is_pug_admin, false)
    FROM _user_person_map m
    JOIN users u ON m.user_id = u.id
    WHERE p.id = m.person_id;
  `)

  // Step 2: Migrate assignedTeams from users_rels to people_rels
  await payload.db.drizzle.execute(sql`
    INSERT INTO people_rels ("order", parent_id, path, teams_id)
    SELECT ur."order", m.person_id, 'assignedTeams', ur.teams_id
    FROM users_rels ur
    JOIN _user_person_map m ON ur.parent_id = m.user_id
    WHERE ur.path = 'assignedTeams'
      AND ur.teams_id IS NOT NULL;
  `)

  // Step 3: Migrate sessions from users_sessions to people_sessions
  await payload.db.drizzle.execute(sql`
    INSERT INTO people_sessions (_order, _parent_id, id, created_at, expires_at)
    SELECT us._order, m.person_id, us.id || '_migrated', us.created_at, us.expires_at
    FROM users_sessions us
    JOIN _user_person_map m ON us._parent_id = m.user_id;
  `)

  // Step 4: Migrate PugPlayer data into People
  await payload.db.drizzle.execute(sql`
    UPDATE people p SET
      pug_battle_tag = pp.battle_tag,
      pug_registered_date = pp.registered_date,
      pug_invited_by_id = m_inviter.person_id,
      pug_active_ban_banned_until = pp.active_ban_banned_until,
      pug_active_ban_reason = pp.active_ban_reason,
      pug_ban_offense_count = COALESCE(pp.ban_offense_count, 0)
    FROM pug_players pp
    JOIN _user_person_map m_user ON pp.user_id = m_user.user_id
    LEFT JOIN _user_person_map m_inviter ON pp.invited_by_id = m_inviter.user_id
    WHERE p.id = m_user.person_id;
  `)

  // Step 5: Migrate PUG tiers
  await payload.db.drizzle.execute(sql`
    INSERT INTO people_pug_tiers ("order", parent_id, id, value)
    SELECT pt."order", m.person_id, gen_random_uuid()::text, pt.value
    FROM pug_players_tiers pt
    JOIN pug_players pp ON pt.parent_id = pp.id
    JOIN _user_person_map m ON pp.user_id = m.user_id;
  `)

  // Step 6: Migrate PUG approved roles
  await payload.db.drizzle.execute(sql`
    INSERT INTO people_pug_approved_roles ("order", parent_id, id, value)
    SELECT par."order", m.person_id, gen_random_uuid()::text, par.value
    FROM pug_players_approved_roles par
    JOIN pug_players pp ON par.parent_id = pp.id
    JOIN _user_person_map m ON pp.user_id = m.user_id;
  `)

  // Step 7: Migrate PUG invite regions
  await payload.db.drizzle.execute(sql`
    INSERT INTO people_pug_invite_regions ("order", parent_id, id, value)
    SELECT pir."order", m.person_id, gen_random_uuid()::text, pir.value::text::enum_people_pug_invite_regions
    FROM pug_players_invite_regions pir
    JOIN pug_players pp ON pir.parent_id = pp.id
    JOIN _user_person_map m ON pp.user_id = m.user_id;
  `)

  // Verification queries
  const emailCheck = await payload.db.drizzle.execute(sql`
    SELECT COUNT(*) as missing FROM _user_person_map m
    JOIN users u ON m.user_id = u.id
    JOIN people p ON m.person_id = p.id
    WHERE u.email IS NOT NULL AND p.email IS NULL;
  `)
  const missingEmails = Number(((emailCheck.rows || emailCheck) as any[])[0]?.missing)
  if (missingEmails > 0) {
    throw new Error(`Data verification failed: ${missingEmails} users have email but their person does not`)
  }

  const roleCheck = await payload.db.drizzle.execute(sql`
    SELECT COUNT(*) as missing FROM _user_person_map m
    JOIN users u ON m.user_id = u.id
    JOIN people p ON m.person_id = p.id
    WHERE u.role IS NOT NULL AND p.role IS NULL;
  `)
  const missingRoles = Number(((roleCheck.rows || roleCheck) as any[])[0]?.missing)
  if (missingRoles > 0) {
    throw new Error(`Data verification failed: ${missingRoles} users have role but their person does not`)
  }

  const pugCheck = await payload.db.drizzle.execute(sql`
    SELECT COUNT(*) as missing FROM pug_players pp
    JOIN _user_person_map m ON pp.user_id = m.user_id
    JOIN people p ON m.person_id = p.id
    WHERE pp.battle_tag IS NOT NULL AND p.pug_battle_tag IS NULL;
  `)
  const missingPug = Number(((pugCheck.rows || pugCheck) as any[])[0]?.missing)
  if (missingPug > 0) {
    throw new Error(`Data verification failed: ${missingPug} pug players have battle_tag but their person does not`)
  }

  payload.logger.info('Phase 2 complete: all user and pug player data migrated to people records')
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Clear migrated sessions
    DELETE FROM people_sessions WHERE id LIKE '%_migrated';

    -- Clear migrated PUG join tables
    DELETE FROM people_pug_invite_regions;
    DELETE FROM people_pug_approved_roles;
    DELETE FROM people_pug_tiers;

    -- Clear migrated assigned teams
    DELETE FROM people_rels WHERE path = 'assignedTeams';

    -- Clear PUG fields on people
    UPDATE people SET
      pug_battle_tag = NULL,
      pug_registered_date = NULL,
      pug_invited_by_id = NULL,
      pug_active_ban_banned_until = NULL,
      pug_active_ban_reason = NULL,
      pug_ban_offense_count = 0;

    -- Clear user fields on people
    UPDATE people SET
      email = NULL,
      hash = NULL,
      salt = NULL,
      reset_password_token = NULL,
      reset_password_expiration = NULL,
      login_attempts = 0,
      lock_until = NULL,
      role = NULL,
      avatar_id = NULL,
      departments_is_production_staff = false,
      departments_is_social_media_staff = false,
      departments_is_graphics_staff = false,
      departments_is_video_staff = false,
      departments_is_events_staff = false,
      departments_is_scouting_staff = false,
      departments_is_content_creator = false,
      departments_is_pug_admin = false;
  `)
}
