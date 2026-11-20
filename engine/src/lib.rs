use std::{cell::RefCell, sync::Arc};

use hayro::{
    PixmapSettings, RenderCache, RenderSettings,
    hayro_interpret::InterpreterSettings,
    hayro_syntax::{LoadPdfError, Pdf},
    vello_cpu::{Pixmap, color::palette::css::WHITE},
};

#[derive(Default)]
struct Engine {
    input: Vec<u8>,
    document: Option<Pdf>,
    pixmap: Option<Pixmap>,
    width: f32,
    height: f32,
}

thread_local! {
    static ENGINE: RefCell<Engine> = RefCell::default();
    static WARNINGS: RefCell<String> = const { RefCell::new(String::new()) };
}

#[unsafe(no_mangle)]
pub extern "C" fn pdf_allocate(size: usize) -> *mut u8 {
    ENGINE.with_borrow_mut(|engine| {
        *engine = Engine::default();
        if size == 0 || size > 64 * 1024 * 1024 {
            return std::ptr::null_mut();
        }
        engine.input = vec![0; size];
        engine.input.as_mut_ptr()
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn pdf_open(limit: usize) -> i32 {
    ENGINE.with_borrow_mut(|engine| {
        match Pdf::new(std::mem::take(&mut engine.input)) {
            Ok(pdf) => {
                let count = pdf.pages().len();
                if count == 0 || count > limit.min(2_000) {
                    return -2;
                }
                engine.document = Some(pdf);
                count as i32
            }
            Err(LoadPdfError::Decryption(_)) => -3,
            Err(_) => -1,
        }
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn pdf_render(number: usize, zoom: f32) -> u32 {
    WARNINGS.with_borrow_mut(String::clear);
    ENGINE.with_borrow_mut(|engine| {
        engine.pixmap = None;
        let Some(page) = engine.document.as_ref().and_then(|pdf| pdf.pages().get(number)) else {
            return 0;
        };
        let (width, height) = page.render_dimensions();
        if ![width, height, zoom].iter().all(|v| v.is_finite() && *v > 0.0)
            || width > 1_000_000.0 || height > 1_000_000.0
        {
            return 0;
        }
        // Leave margins only for axes too small to occupy a full pixel.
        let scale = zoom.min(4096.0 / width).min(4096.0 / height)
            .min((4_000_000.0 / (width * height)).sqrt());
        let x_scale = scale.max(1.0 / width);
        let y_scale = scale.max(1.0 / height);
        let pixel_width = (width * x_scale) as u32;
        let pixel_height = (height * y_scale) as u32;
        if pixel_width == 0 || pixel_height == 0 || pixel_width > 4096 || pixel_height > 4096
            || pixel_width * pixel_height > 4_000_000
        {
            return 0;
        }
        let interpreter = InterpreterSettings {
            warning_sink: Arc::new(|warning| {
                WARNINGS.with_borrow_mut(|warnings| {
                    if warnings.len() < 1024 {
                        use std::fmt::Write as _;
                        let _ = writeln!(warnings, "{warning:?}");
                    }
                });
            }),
            ..Default::default()
        };
        let pixmap = hayro::render(
            page, &RenderCache::new(), &interpreter, &RenderSettings::default(),
            &PixmapSettings { x_scale, y_scale, bg_color: WHITE },
        );
        engine.width = width;
        engine.height = height;
        let dimensions = (u32::from(pixmap.height()) << 16) | u32::from(pixmap.width());
        engine.pixmap = Some(pixmap);
        dimensions
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn pdf_width() -> f32 {
    ENGINE.with_borrow(|engine| engine.width)
}

#[unsafe(no_mangle)]
pub extern "C" fn pdf_height() -> f32 {
    ENGINE.with_borrow(|engine| engine.height)
}

#[unsafe(no_mangle)]
pub extern "C" fn pixel_pointer() -> *const u8 {
    ENGINE.with_borrow(|engine| {
        engine.pixmap.as_ref().map_or(std::ptr::null(), |p| p.data_as_u8_slice().as_ptr())
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn release_pixels() {
    ENGINE.with_borrow_mut(|engine| engine.pixmap = None);
}

#[unsafe(no_mangle)]
pub extern "C" fn warnings_pointer() -> *const u8 {
    WARNINGS.with_borrow(|warnings| warnings.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn warnings_length() -> usize {
    WARNINGS.with_borrow(String::len)
}

