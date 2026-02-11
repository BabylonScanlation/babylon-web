-- Migration 0009: Add country column to AnonymousUsers for geolocation analytics
ALTER TABLE `AnonymousUsers` ADD `country` text;
