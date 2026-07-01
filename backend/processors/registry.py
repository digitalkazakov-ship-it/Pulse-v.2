from . import bht, sales, ad_spend, creatives, ecom, presence, perception, media_details
from . import neuro, wordstat, digital

PROCESSORS: dict = {
    'bht':           bht.process,
    'sales':         sales.process,
    'ad_spend':      ad_spend.process,
    'creatives':     creatives.process,
    'ecom':          ecom.process,
    'presence':      presence.process,
    'perception':    perception.process,
    'media_details': media_details.process,
    'neuro':         neuro.process,
    'wordstat':      wordstat.process,
}

MULTI_FILE_PROCESSORS: dict = {
    'digital': digital.process,
}
