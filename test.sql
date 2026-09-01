insert into "Users" ("id", "email") values ('psCWyZZhf0aJjCkGx9XDDkphSea2', 'daftely0@gmail.com') on conflict ("Users"."id") do update set email = excluded.email;
