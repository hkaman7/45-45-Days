/** Left-box body for the "Crop Loss Probability" sub-tab - real-time crop-loss
 * probability, computed with the same trained model/strategy as the routine
 * forecast (03_train_crop_loss_model.py / 06_predict_crop_loss.py), but fed
 * real-time weather + remote-sensing-derived features instead of the S2S
 * forecast. Corn only for now (matches the one heat event this pass covers). */
export function CropLossProbabilityControls() {
  return (
    <>
      <div className="control-group">
        <label className="control-label">Crop</label>
        <div className="static-value">Corn</div>
      </div>
      <p className="muted subtab-note">
        National real-time crop-loss probability, recomputed from the latest observed weather and satellite-derived
        crop-health signal - not the routine subseasonal forecast shown in Risk Viewer.
      </p>
    </>
  );
}
