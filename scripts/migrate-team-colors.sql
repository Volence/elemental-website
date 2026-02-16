-- Team Branding Colors Migration
-- Safe UPDATE-only script — only sets branding_primary and branding_secondary
-- Does NOT modify any other columns or delete any data
-- Run AFTER the Payload migration has added the columns

BEGIN;

UPDATE teams SET branding_primary = '#1E90FF', branding_secondary = '#0D0D2B' WHERE name = 'Abyss';
UPDATE teams SET branding_primary = '#39FF14', branding_secondary = '#228B22' WHERE name = 'Bug';
UPDATE teams SET branding_primary = '#E040FB', branding_secondary = '#1A237E' WHERE name = 'Cosmic';
UPDATE teams SET branding_primary = '#D2691E', branding_secondary = '#4E2F15' WHERE name = 'Crust';
UPDATE teams SET branding_primary = '#6A0DAD', branding_secondary = '#1A0025' WHERE name = 'Dark';
UPDATE teams SET branding_primary = '#FF4500', branding_secondary = '#6A0DAD' WHERE name = 'Dragon';
UPDATE teams SET branding_primary = '#FFFF00', branding_secondary = '#0080FF' WHERE name = 'Electric';
UPDATE teams SET branding_primary = '#FF69B4', branding_secondary = '#DA70D6' WHERE name = 'Fairy';
UPDATE teams SET branding_primary = '#FF2400', branding_secondary = '#8B0000' WHERE name = 'Fighting';
UPDATE teams SET branding_primary = '#FF2020', branding_secondary = '#8B1A1A' WHERE name = 'Fire';
UPDATE teams SET branding_primary = '#32CD32', branding_secondary = '#1B5E20' WHERE name = 'Garden';
UPDATE teams SET branding_primary = '#8B5CF6', branding_secondary = '#4C1D95' WHERE name = 'Ghost';
UPDATE teams SET branding_primary = '#00E676', branding_secondary = '#2E7D32' WHERE name = 'Grass';
UPDATE teams SET branding_primary = '#DAA520', branding_secondary = '#5C4033' WHERE name = 'Ground';
UPDATE teams SET branding_primary = '#F0E68C', branding_secondary = '#FFFAF0' WHERE name = 'Heaven';
UPDATE teams SET branding_primary = '#00FFFF', branding_secondary = '#1565C0' WHERE name = 'Ice';
UPDATE teams SET branding_primary = '#FF5722', branding_secondary = '#B71C1C' WHERE name = 'Impact';
UPDATE teams SET branding_primary = '#FFD700', branding_secondary = '#B8860B' WHERE name = 'Lumen';
UPDATE teams SET branding_primary = '#B0C4DE', branding_secondary = '#2C3E6B' WHERE name = 'Lunar';
UPDATE teams SET branding_primary = '#E0E0E0', branding_secondary = '#6B6B6B' WHERE name = 'Normal';
UPDATE teams SET branding_primary = '#9D00FF', branding_secondary = '#39FF14' WHERE name = 'Poison';
UPDATE teams SET branding_primary = '#FF1493', branding_secondary = '#00CED1' WHERE name = 'Reality';
UPDATE teams SET branding_primary = '#C2A678', branding_secondary = '#5C4A32' WHERE name = 'Rock';
UPDATE teams SET branding_primary = '#708090', branding_secondary = '#1C1C1C' WHERE name = 'Shade';
UPDATE teams SET branding_primary = '#A8C4D0', branding_secondary = '#3B5068' WHERE name = 'Steel';
UPDATE teams SET branding_primary = '#FFEA00', branding_secondary = '#FF6F00' WHERE name = 'Stellar';
UPDATE teams SET branding_primary = '#C0C0FF', branding_secondary = '#0A0A14' WHERE name = 'Void';
UPDATE teams SET branding_primary = '#00BFFF', branding_secondary = '#003366' WHERE name = 'Water';

COMMIT;
