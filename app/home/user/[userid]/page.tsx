"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Container,
  Box,
  Typography,
  Avatar,
  Paper,
  Skeleton,
} from "@mui/material";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Utility: Calculate the user's level from exp.
const calculateLevel = (exp: number | null) => {
  if (!exp || exp <= 0) return { level: 1, currentExp: 0, nextExp: 100 };
  let level = 1;
  let expNeeded = 100;
  while (exp >= expNeeded && level < 100) {
    exp -= expNeeded;
    level++;
    expNeeded += 50;
  }
  return { level, currentExp: exp, nextExp: expNeeded };
};

interface UserData {
  id: string;
  username: string;
  profile_pic: string | null;
  exp: number;
  visibility: "Public" | "Private";
}

interface Achievement {
  achv_id: string;
  time_data: string;
  name: string;
  image: string;
}

export const metadata = {
  title: 'User',
  description: 'User Page for Ailice',
};


export default function UserProfilePage() {
  const router = useRouter();
  const { userid } = useParams(); // Get the dynamic [userid] parameter
  const [userData, setUserData] = useState<UserData | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

  // 1. Fetch the current logged-in user (if any) via the /api/check-auth endpoint.
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser({ id: data.id });
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  // 2. Fetch the profile user’s details from the "users" table using the [userid].
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, profile_pic, exp, visibility")
          .eq("id", userid)
          .single();

        if (error || !data) {
          console.error("Error fetching user data:", error);
          router.push("/"); // Redirect if the user is not found
          return;
        }
        setUserData(data as UserData);
      } catch (error) {
        console.error("Error fetching user data:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    if (userid) {
      fetchUserData();
    }
  }, [userid, router]);

  // 3. If the profile is public or if the current user is the owner,
  // fetch the user's achievements.
  useEffect(() => {
    const fetchAchievements = async () => {
      if (!userData) return;
      if (
        userData.visibility === "Public" ||
        (currentUser && currentUser.id === userData.id)
      ) {
        try {
          // Note: The query selects "time_date" from the database.
          const { data: userAcvData, error: acvError } = await supabase
            .from("user_acv")
            .select("achv_id, time_date")
            .eq("user_id", userid);

          if (acvError) {
            console.error("Error fetching user achievements:", acvError);
            return;
          }
          if (!userAcvData) return;

          // For each record, fetch the achievement details from the "achievements" table.
          const achievementPromises = userAcvData.map(async (record: any) => {
            const { data: achvData, error: achvError } = await supabase
              .from("achievements")
              .select("name, image")
              .eq("id", record.achv_id)
              .single();
            if (achvError || !achvData) {
              console.error("Error fetching achievement detail:", achvError);
              return null;
            }
            return {
              achv_id: record.achv_id,
              time_data: record.time_date, // Use time_date from the DB
              name: achvData.name,
              image: achvData.image,
            } as Achievement;
          });
          const achievementsData = await Promise.all(achievementPromises);
          setAchievements(
            achievementsData.filter((achv) => achv !== null) as Achievement[]
          );
        } catch (error) {
          console.error("Error fetching achievements:", error);
        } finally {
          setAchievementsLoading(false);
        }
      } else {
        setAchievementsLoading(false);
      }
    };
    fetchAchievements();
  }, [userData, currentUser, userid]);

  // Show a skeleton UI while loading the user profile data.
  if (loading || !userData) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper elevation={4} sx={{ p: 4, borderRadius: 2 }}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <Skeleton variant="circular" width={100} height={100} />
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="40%" height={20} />
            <Skeleton variant="text" width="30%" height={20} />
          </Box>
        </Paper>
      </Container>
    );
  }

  // Calculate the level using the provided function.
  const levelData = calculateLevel(userData.exp);

  // Build the profile picture URL.
  const profilePicUrl = userData.profile_pic
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${userData.profile_pic}`
    : "";

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper elevation={4} sx={{ p: 4, borderRadius: 2 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <Avatar
            src={profilePicUrl}
            alt={userData.username}
            sx={{ width: 100, height: 100 }}
          />
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            {userData.username}
          </Typography>

          {/* Visibility Message */}
          {currentUser && currentUser.id === userData.id ? (
            <Typography variant="body2" color="text.secondary">
              {userData.visibility === "Public"
                ? "Your profile is Public"
                : "Your profile is currently Private"}
            </Typography>
          ) : (
            userData.visibility === "Private" && (
              <Typography variant="body2" color="text.secondary">
                This profile has privated their account
              </Typography>
            )
          )}

          {(userData.visibility === "Public" ||
            (currentUser && currentUser.id === userData.id)) && (
            <>
              <Typography variant="body1">Level {levelData.level}</Typography>

              {/* Achievements Section */}
              {achievementsLoading ? (
                <Box width="100%" mt={4}>
                  <Skeleton variant="text" width="40%" height={30} />
                  {[1, 2, 3].map((item) => (
                    <Box
                      key={item}
                      display="flex"
                      alignItems="center"
                      gap={2}
                      mb={2}
                    >
                      <Skeleton variant="rectangular" width={60} height={60} />
                      <Box>
                        <Skeleton variant="text" width={100} height={20} />
                        <Skeleton variant="text" width={120} height={15} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                achievements.length > 0 && (
                  <Box width="100%" mt={4}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Achievements Gained:
                    </Typography>
                    {achievements.map((achv) => (
                      <Box
                        key={achv.achv_id}
                        display="flex"
                        alignItems="center"
                        gap={2}
                        mb={2}
                      >
                        <Box
                          component="img"
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/achivements/${achv.image}`}
                          alt={achv.name}
                          sx={{ width: 60, height: 60, borderRadius: 2 }}
                        />
                        <Box>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: "bold" }}
                          >
                            {achv.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(achv.time_data).toLocaleString("en-US", {
                              timeZone: "Asia/Manila",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )
              )}
            </>
          )}
        </Box>
      </Paper>
    </Container>
  );
}
