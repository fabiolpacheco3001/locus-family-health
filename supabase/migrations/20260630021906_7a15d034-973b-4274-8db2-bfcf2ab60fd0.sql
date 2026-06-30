CREATE INDEX IF NOT EXISTS idx_consent_log_user_id
  ON public.consent_log (user_id);

ALTER POLICY "passkeys_select_own" ON public.passkeys
  TO authenticated
  USING (user_id = (select auth.uid()));

ALTER POLICY "passkeys_delete_own" ON public.passkeys
  TO authenticated
  USING (user_id = (select auth.uid()));

ALTER POLICY "Users can view own family members" ON public.family_members
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own family members" ON public.family_members
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can delete own family members" ON public.family_members
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Group members can update family members" ON public.family_members
  USING (
    EXISTS (
      SELECT 1 FROM public.family_group_members
      WHERE auth_user_id = (select auth.uid())
        AND group_id = family_members.group_id
        AND role = 'admin'
    )
    OR id = (
      SELECT family_member_id FROM public.family_group_members
      WHERE auth_user_id = (select auth.uid()) LIMIT 1
    )
    OR id IN (
      SELECT unnest(managed_profiles) FROM public.family_group_members
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "Users can view own consultations" ON public.consultations
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own consultations" ON public.consultations
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
      WHERE fm.id = consultations.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND fm.deleted_at IS NULL
        AND (fgm.role = 'admin' OR fm.user_id = (select auth.uid()) OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[])))
    )
  );

ALTER POLICY "Group members can update consultations" ON public.consultations
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = consultations.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Group members can delete consultations" ON public.consultations
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = consultations.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Users can view own exams" ON public.exams
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own exams" ON public.exams
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
      WHERE fm.id = exams.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND fm.deleted_at IS NULL
        AND (fgm.role = 'admin' OR fm.user_id = (select auth.uid()) OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[])))
    )
  );

ALTER POLICY "Group members can update exams" ON public.exams
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = exams.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Group members can delete exams" ON public.exams
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = exams.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Group members can view medications" ON public.medications
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = medications.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = fgm.family_member_id OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Users can insert own medications" ON public.medications
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
      WHERE fm.id = medications.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND fm.deleted_at IS NULL
        AND (fgm.role = 'admin' OR fm.user_id = (select auth.uid()) OR fm.id = ANY(COALESCE(fgm.managed_profiles, '{}'::uuid[])))
    )
  );

ALTER POLICY "Group members can update medications" ON public.medications
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = medications.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND fgm.role = 'admin'
    )
  );

ALTER POLICY "Group members can delete medications" ON public.medications
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = medications.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND fgm.role = 'admin'
    )
  );

ALTER POLICY "Users can view medication doses" ON public.medication_doses
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_doses.medication_id
        AND (
          m.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.family_members fm
            JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
            WHERE fm.id = m.family_member_id
              AND fgm.auth_user_id = (select auth.uid())
              AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
          )
        )
    )
  );

ALTER POLICY "Users can insert medication doses" ON public.medication_doses
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_doses.medication_id
        AND (
          m.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.family_members fm
            JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
            WHERE fm.id = m.family_member_id
              AND fgm.auth_user_id = (select auth.uid())
              AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
          )
        )
    )
  );

ALTER POLICY "Users can delete medication doses" ON public.medication_doses
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = medication_doses.medication_id
        AND (
          m.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.family_members fm
            JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
            WHERE fm.id = m.family_member_id
              AND fgm.auth_user_id = (select auth.uid())
              AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
          )
        )
    )
  );

ALTER POLICY "Users can select own allergies" ON public.allergies USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own allergies" ON public.allergies WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own allergies" ON public.allergies USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own allergies" ON public.allergies USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own diseases" ON public.diseases
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Group members can view diseases" ON public.diseases
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = diseases.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = fgm.family_member_id OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Group members can update diseases" ON public.diseases
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = diseases.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Group members can delete diseases" ON public.diseases
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = diseases.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Users can select own vaccines" ON public.vaccines USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own vaccines" ON public.vaccines WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own vaccines" ON public.vaccines USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own vaccines" ON public.vaccines USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can select own health_measurements" ON public.health_measurements USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own health_measurements" ON public.health_measurements WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own health_measurements" ON public.health_measurements USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own health_measurements" ON public.health_measurements USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can select own blood_pressure_history" ON public.blood_pressure_history USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own blood_pressure_history" ON public.blood_pressure_history WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own blood_pressure_history" ON public.blood_pressure_history USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own blood_pressure_history" ON public.blood_pressure_history USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can select own menstrual_cycles" ON public.menstrual_cycles USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own menstrual_cycles" ON public.menstrual_cycles WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own menstrual_cycles" ON public.menstrual_cycles USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own menstrual_cycles" ON public.menstrual_cycles USING ((select auth.uid()) = user_id);

ALTER POLICY "User sees own push subscriptions" ON public.push_subscriptions
  USING ((select auth.uid()) = user_id);
ALTER POLICY "User inserts own push subscriptions" ON public.push_subscriptions
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "User updates own push subscriptions" ON public.push_subscriptions
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "User deletes own push subscriptions" ON public.push_subscriptions
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Members can view their group" ON public.family_groups
  USING (public.is_group_member((select auth.uid()), id));
ALTER POLICY "Admins can update their group" ON public.family_groups
  USING (public.is_group_admin((select auth.uid()), id));

ALTER POLICY "Members can view group members" ON public.family_group_members
  USING (public.is_group_member((select auth.uid()), group_id));
ALTER POLICY "Admins can manage group members" ON public.family_group_members
  USING (public.is_group_admin((select auth.uid()), group_id))
  WITH CHECK (public.is_group_admin((select auth.uid()), group_id));

ALTER POLICY "Admins can manage group invites" ON public.group_invites
  USING (public.is_group_admin((select auth.uid()), group_id))
  WITH CHECK (public.is_group_admin((select auth.uid()), group_id));

ALTER POLICY "Group members can view notifications" ON public.notifications
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = notifications.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin'::app_role OR fm.id = fgm.family_member_id OR fm.id = ANY(fgm.managed_profiles))
    )
    OR (notifications.family_member_id IS NULL AND (select auth.uid()) = notifications.user_id)
  );

ALTER POLICY "Users can insert own notifications" ON public.notifications
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Group members can update notifications" ON public.notifications
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = notifications.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Group members can delete notifications" ON public.notifications
  USING (
    (select auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.family_group_members fgm ON fm.group_id = fgm.group_id
      WHERE fm.id = notifications.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND (fgm.role = 'admin' OR fm.id = ANY(fgm.managed_profiles))
    )
  );

ALTER POLICY "Group members can view surgeries" ON public.surgeries
  USING (
    EXISTS (
      SELECT 1 FROM public.family_group_members fgm
      WHERE fgm.group_id = surgeries.group_id AND fgm.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "Users can insert own surgeries" ON public.surgeries
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.family_members fm
      INNER JOIN public.family_group_members fgm ON fgm.group_id = fm.group_id
      WHERE fm.id = surgeries.family_member_id
        AND fgm.auth_user_id = (select auth.uid())
        AND fm.group_id = surgeries.group_id
    )
  );

ALTER POLICY "Group members can update surgeries" ON public.surgeries
  USING (
    EXISTS (
      SELECT 1 FROM public.family_group_members fgm
      WHERE fgm.group_id = surgeries.group_id AND fgm.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "Group members can delete surgeries" ON public.surgeries
  USING (
    EXISTS (
      SELECT 1 FROM public.family_group_members fgm
      WHERE fgm.group_id = surgeries.group_id AND fgm.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "Group members can view surgery_instructions" ON public.surgery_instructions
  USING (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id
        AND fgm.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "Group members can insert surgery_instructions" ON public.surgery_instructions
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id
        AND fgm.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "Group members can update surgery_instructions" ON public.surgery_instructions
  USING (
    EXISTS (
      SELECT 1 FROM public.surgeries s
      JOIN public.family_group_members fgm ON fgm.group_id = s.group_id
      WHERE s.id = surgery_instructions.surgery_id
        AND fgm.auth_user_id = (select auth.uid())
    )
  );