image - remove background command that worked well for presents:

```
    magick INPUT -alpha set -fuzz 10% -transparent white \
    -channel A -morphology Erode Disk:1 +channel OUTPUT

```
